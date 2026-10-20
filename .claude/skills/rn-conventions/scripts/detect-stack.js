#!/usr/bin/env node
/**
 * detect-stack.js — zero-dependency stack detector for React Native / Expo projects.
 *
 * Usage:
 *   node ~/.claude/skills/rn-conventions/scripts/detect-stack.js [projectDir]
 *
 * Prints a JSON report to stdout. Never modifies anything.
 * Can also be required: const { detectStack } = require('./detect-stack.js'); detectStack(dir)
 * Walks up from projectDir (default: cwd) to find the nearest package.json
 * that depends on react-native or expo (handles monorepos / running from a subfolder).
 */
'use strict';

const fs = require('fs');
const path = require('path');


function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}
function exists(...parts) {
  return fs.existsSync(path.join(...parts));
}
function firstExisting(root, candidates) {
  return candidates.find((c) => exists(root, c)) || null;
}

function detectStack(startDir) {
const start = path.resolve(startDir || process.cwd());

// ---- locate project root -------------------------------------------------
function isRNPackage(pkg) {
  if (!pkg) return false;
  const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  return Boolean(all['react-native'] || all['expo']);
}

let root = null;
let dir = start;
while (true) {
  const pkg = readJSON(path.join(dir, 'package.json'));
  if (isRNPackage(pkg)) { root = dir; break; }
  const parent = path.dirname(dir);
  if (parent === dir) break;
  dir = parent;
}

if (!root) {
  // Maybe we're at a monorepo root: look one/two levels down for an RN app.
  const searchDirs = ['apps', 'packages', 'app', 'mobile', '.'];
  outer: for (const sd of searchDirs) {
    const base = path.join(start, sd);
    let entries = [];
    try { entries = fs.readdirSync(base, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const candidate = path.join(base, e.name);
      if (isRNPackage(readJSON(path.join(candidate, 'package.json')))) { root = candidate; break outer; }
    }
  }
}

if (!root) {
  return { isReactNative: false, searchedFrom: start };
}

const pkg = readJSON(path.join(root, 'package.json')) || {};
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const has = (name) => Object.prototype.hasOwnProperty.call(deps, name);
const ver = (name) => (has(name) ? String(deps[name]) : null);
const hasPrefix = (prefix) => Object.keys(deps).some((d) => d.startsWith(prefix));
const pick = (map) => Object.entries(map).filter(([, test]) => test()).map(([label]) => label);

// ---- monorepo / package manager -----------------------------------------
function findUp(fileNames, from) {
  let d = from;
  while (true) {
    for (const f of fileNames) if (fs.existsSync(path.join(d, f))) return path.join(d, f);
    const parent = path.dirname(d);
    if (parent === d) return null;
    d = parent;
  }
}
const lockfile = findUp(['bun.lockb', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'], root);
const packageManager = lockfile
  ? ({ 'bun.lockb': 'bun', 'bun.lock': 'bun', 'pnpm-lock.yaml': 'pnpm', 'yarn.lock': 'yarn', 'package-lock.json': 'npm' })[path.basename(lockfile)]
  : (pkg.packageManager ? String(pkg.packageManager).split('@')[0] : 'npm');
const workspaceRoot = lockfile ? path.dirname(lockfile) : root;
const isMonorepo = workspaceRoot !== root || Boolean(pkg.workspaces) || exists(root, 'pnpm-workspace.yaml');

// ---- Expo / app config ---------------------------------------------------
const appJson = readJSON(path.join(root, 'app.json'));
const appConfigFile = firstExisting(root, ['app.config.ts', 'app.config.js', 'app.config.mjs', 'app.config.cjs']);
const appConfigText = appConfigFile ? readText(path.join(root, appConfigFile)) : null;
const expoCfg = (appJson && (appJson.expo || appJson)) || {};
const easJson = readJSON(path.join(root, 'eas.json'));

const hasIos = exists(root, 'ios');
const hasAndroid = exists(root, 'android');
const iosGitignored = (() => {
  const gi = readText(path.join(root, '.gitignore')) || '';
  return /^\/?ios\/?$/m.test(gi) && /^\/?android\/?$/m.test(gi);
})();

let workflow;
if (!has('expo')) workflow = 'bare-react-native';
else if (!hasIos && !hasAndroid) workflow = 'expo-managed (CNG)';
else if (iosGitignored) workflow = 'expo-managed (CNG, native dirs generated locally & gitignored)';
else workflow = 'expo-bare (native dirs committed)';

function expoSdkFromVersion(v) {
  if (!v) return null;
  const m = String(v).match(/(\d+)\./);
  return m ? Number(m[1]) : null;
}

// New Architecture detection
function newArch() {
  const gradleProps = readText(path.join(root, 'android', 'gradle.properties')) || '';
  const podfileProps = readJSON(path.join(root, 'ios', 'Podfile.properties.json')) || {};
  if (typeof expoCfg.newArchEnabled === 'boolean') return expoCfg.newArchEnabled ? 'enabled (app config)' : 'disabled (app config)';
  if (appConfigText && /newArchEnabled\s*:\s*false/.test(appConfigText)) return 'disabled (app config)';
  if (appConfigText && /newArchEnabled\s*:\s*true/.test(appConfigText)) return 'enabled (app config)';
  if (/newArchEnabled\s*=\s*false/.test(gradleProps) || podfileProps['newArchEnabled'] === 'false') return 'disabled (native config)';
  if (/newArchEnabled\s*=\s*true/.test(gradleProps) || podfileProps['newArchEnabled'] === 'true') return 'enabled (native config)';
  const sdk = expoSdkFromVersion(ver('expo'));
  if (sdk && sdk >= 52) return 'likely enabled (Expo SDK 52+ default)';
  const rn = ver('react-native');
  const rnMinor = rn && Number((rn.match(/0\.(\d+)/) || [])[1]);
  if (rnMinor && rnMinor >= 76) return 'likely enabled (RN 0.76+ default)';
  return 'unknown';
}

// ---- source layout -------------------------------------------------------
const srcRoot = firstExisting(root, ['src']) || '.';
const appDir = firstExisting(root, ['src/app', 'app']);
const routerDetected = has('expo-router');
const screensDir = firstExisting(root, ['src/screens', 'screens', 'src/features', 'src/modules', 'src/pages']);
const componentsDir = firstExisting(root, ['src/components', 'components', 'src/ui', 'src/shared/ui', 'src/shared/components']);
const localesDir = firstExisting(root, [
  'src/i18n/locales', 'src/locales', 'locales', 'src/i18n', 'i18n', 'assets/locales', 'src/translations', 'translations', 'src/lang', 'lang',
]);

// ---- test setup ----------------------------------------------------------
const jestConfigFile = firstExisting(root, ['jest.config.js', 'jest.config.ts', 'jest.config.cjs', 'jest.config.mjs', 'jest.config.json']);
const hasJest = has('jest') || has('jest-expo') || Boolean(jestConfigFile) || Boolean(pkg.jest);
const scripts = pkg.scripts || {};

// ---- assemble report -----------------------------------------------------
const report = {
  isReactNative: true,
  projectRoot: root,
  workspaceRoot: isMonorepo ? workspaceRoot : undefined,
  isMonorepo,
  packageManager,
  runCmd: { npm: 'npx', yarn: 'yarn', pnpm: 'pnpm exec', bun: 'bunx' }[packageManager] || 'npx',
  typescript: exists(root, 'tsconfig.json') || has('typescript'),

  versions: {
    reactNative: ver('react-native'),
    react: ver('react'),
    expo: ver('expo'),
    expoSdk: expoSdkFromVersion(ver('expo')),
  },

  workflow,
  nativeDirs: { ios: hasIos, android: hasAndroid },
  newArchitecture: newArch(),
  appConfig: appConfigFile || (appJson ? 'app.json' : null),
  app: {
    name: expoCfg.name || pkg.name || null,
    version: expoCfg.version || pkg.version || null,
    iosBundleId: (expoCfg.ios && expoCfg.ios.bundleIdentifier) || null,
    iosBuildNumber: (expoCfg.ios && expoCfg.ios.buildNumber) || null,
    androidPackage: (expoCfg.android && expoCfg.android.package) || null,
    androidVersionCode: (expoCfg.android && expoCfg.android.versionCode) || null,
    runtimeVersion: expoCfg.runtimeVersion || null,
    note: appConfigFile ? 'Dynamic app config present — values above may be incomplete; read ' + appConfigFile : undefined,
  },

  eas: easJson ? {
    present: true,
    buildProfiles: Object.keys(easJson.build || {}),
    submitProfiles: Object.keys(easJson.submit || {}),
    appVersionSource: (easJson.cli && easJson.cli.appVersionSource) || 'local (default)',
    autoIncrement: Object.entries(easJson.build || {}).filter(([, v]) => v && v.autoIncrement).map(([k]) => k),
  } : { present: false },
  otaUpdates: has('expo-updates'),

  navigation: pick({
    'expo-router': () => routerDetected,
    'react-navigation': () => hasPrefix('@react-navigation/'),
    'react-native-navigation (wix)': () => has('react-native-navigation'),
  }),
  routerAppDir: routerDetected ? appDir : null,

  state: pick({
    'redux-toolkit': () => has('@reduxjs/toolkit'),
    'redux': () => has('redux') && !has('@reduxjs/toolkit'),
    'zustand': () => has('zustand'),
    'jotai': () => has('jotai'),
    'mobx': () => has('mobx'),
    'recoil': () => has('recoil'),
    'valtio': () => has('valtio'),
    'xstate': () => has('xstate'),
    'legend-state': () => has('@legendapp/state'),
  }),
  serverState: pick({
    'tanstack-query': () => has('@tanstack/react-query'),
    'swr': () => has('swr'),
    'apollo': () => has('@apollo/client'),
    'urql': () => has('urql'),
    'rtk-query': () => has('@reduxjs/toolkit'),
  }),

  styling: (() => {
    const s = pick({
      'nativewind': () => has('nativewind'),
      'twrnc': () => has('twrnc'),
      'tamagui': () => has('tamagui') || hasPrefix('@tamagui/'),
      'unistyles': () => has('react-native-unistyles'),
      'restyle': () => has('@shopify/restyle'),
      'styled-components': () => has('styled-components'),
      'emotion': () => hasPrefix('@emotion/'),
      'gluestack': () => hasPrefix('@gluestack-ui/'),
      'react-native-paper': () => has('react-native-paper'),
    });
    return s.length ? s : ['StyleSheet (default)'];
  })(),

  animation: pick({
    'reanimated': () => has('react-native-reanimated'),
    'moti': () => has('moti'),
    'lottie': () => has('lottie-react-native'),
    'skia': () => has('@shopify/react-native-skia'),
  }),
  lists: pick({
    'flash-list': () => has('@shopify/flash-list'),
    'legend-list': () => has('@legendapp/list'),
  }),
  images: pick({
    'expo-image': () => has('expo-image'),
    'fast-image': () => has('react-native-fast-image') || has('@d11/react-native-fast-image'),
  }),
  forms: pick({
    'react-hook-form': () => has('react-hook-form'),
    'formik': () => has('formik'),
  }),
  validation: pick({ zod: () => has('zod'), yup: () => has('yup'), valibot: () => has('valibot') }),

  i18n: {
    libraries: pick({
      'i18next': () => has('i18next') || has('react-i18next'),
      'expo-localization': () => has('expo-localization'),
      'react-native-localize': () => has('react-native-localize'),
      'react-intl': () => has('react-intl'),
      'lingui': () => hasPrefix('@lingui/'),
      'i18n-js': () => has('i18n-js'),
    }),
    localesDir,
  },

  testing: {
    unit: hasJest ? (has('jest-expo') ? 'jest (jest-expo preset)' : 'jest') : (has('vitest') ? 'vitest' : null),
    jestConfig: jestConfigFile || (pkg.jest ? 'package.json#jest' : null),
    rntl: has('@testing-library/react-native'),
    e2e: pick({
      'detox': () => has('detox'),
      'maestro': () => exists(root, '.maestro') || exists(root, 'maestro'),
      'appium': () => has('appium') || has('webdriverio'),
    }),
    testScript: scripts.test || null,
  },

  quality: {
    eslint: has('eslint') || Boolean(firstExisting(root, ['.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js', 'eslint.config.mjs'])),
    prettier: has('prettier') || Boolean(firstExisting(root, ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js'])),
    biome: has('@biomejs/biome'),
    lintScript: scripts.lint || null,
    typecheckScript: scripts.typecheck || scripts['type-check'] || scripts.tsc || null,
  },

  storybook: hasPrefix('@storybook/'),
  monitoring: pick({
    'sentry': () => has('@sentry/react-native') || has('sentry-expo'),
    'bugsnag': () => hasPrefix('@bugsnag/'),
    'firebase-crashlytics': () => has('@react-native-firebase/crashlytics'),
  }),

  layout: {
    srcRoot,
    appDir,
    screensDir,
    componentsDir,
    pathAliases: (() => {
      const ts = readText(path.join(root, 'tsconfig.json')) || '';
      const m = ts.match(/"paths"\s*:\s*\{([^}]*)\}/);
      return m ? (m[1].match(/"([^"]+)"\s*:/g) || []).map((s) => s.replace(/[":\s]/g, '')) : [];
    })(),
  },

  scripts: Object.keys(scripts),
};

return JSON.parse(JSON.stringify(report));
}

module.exports = { detectStack };

if (require.main === module) {
  console.log(JSON.stringify(detectStack(process.argv[2]), null, 2));
}
