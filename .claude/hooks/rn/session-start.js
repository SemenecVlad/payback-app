#!/usr/bin/env node
'use strict';
/**
 * SessionStart. Matcher: startup|resume|clear|compact
 * Only in React Native / Expo projects. Plain stdout is added to Claude's context.
 *
 *  sessionStackContext     — compact stack summary, so skills in the main session don't need to re-detect
 *  sessionEnvCheck         — Node version vs .nvmrc / .node-version / engines.node; node_modules present and fresh
 *  sessionTypecheckBaseline — (startup/clear) records existing TS errors in the background, so later gates
 *                            only report errors introduced in this session
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const c = require('./lib/common');

function major(v) {
  const m = String(v || '').match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function nodeCheck(root) {
  const current = process.versions.node;
  const cur = major(current);
  let wanted = null;
  let source = null;
  for (const f of ['.nvmrc', '.node-version', '.tool-versions']) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    let t = fs.readFileSync(p, 'utf8').trim();
    if (f === '.tool-versions') t = (t.match(/^nodejs\s+(\S+)/m) || [])[1] || '';
    if (t) { wanted = t; source = f; break; }
  }
  if (!wanted) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).engines;
      if (e && e.node) { wanted = e.node; source = 'package.json engines.node'; }
    } catch { /* ignore */ }
  }
  if (!wanted || /lts|node|latest|stable/i.test(wanted) && !/\d/.test(wanted)) return null;
  const w = major(wanted);
  if (w == null) return null;
  const isRange = />=|\^|~|\|\||>/.test(wanted);
  if (isRange) {
    if (/^>=?\s*\d/.test(wanted.trim()) && cur < w) return `Node ${current} is older than required ${wanted} (${source}).`;
    return null;
  }
  return cur !== w ? `Node ${current} is active but the project pins ${wanted} (${source}).` : null;
}

function depsCheck(root, stack) {
  const nm = path.join(root, 'node_modules');
  const wsNm = stack.workspaceRoot ? path.join(stack.workspaceRoot, 'node_modules') : null;
  if (!fs.existsSync(nm) && !(wsNm && fs.existsSync(wsNm))) return `node_modules is missing — dependencies are not installed (\`${stack.packageManager} install\`).`;
  const lockDir = stack.workspaceRoot || root;
  const lock = ['bun.lockb', 'bun.lock', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'].map((f) => path.join(lockDir, f)).find((p) => fs.existsSync(p));
  const marker = [
    path.join(lockDir, 'node_modules', '.package-lock.json'),
    path.join(lockDir, 'node_modules', '.yarn-state.yml'),
    path.join(lockDir, 'node_modules', '.yarn-integrity'),
    path.join(lockDir, 'node_modules', '.modules.yaml'),
  ].find((p) => fs.existsSync(p)) || path.join(lockDir, 'node_modules');
  try {
    if (lock && fs.statSync(lock).mtimeMs > fs.statSync(marker).mtimeMs + 2000) {
      return `${path.basename(lock)} is newer than the installed node_modules — dependencies may be out of date (\`${stack.packageManager} install\`).`;
    }
  } catch { /* ignore */ }
  return null;
}

function summary(s) {
  const list = (a) => (a && a.length ? a.join(', ') : 'none');
  return [
    `React Native project detected at ${s.projectRoot}${s.isMonorepo ? ' (monorepo package)' : ''}:`,
    `- RN ${s.versions.reactNative || '?'}${s.versions.expo ? `, Expo SDK ${s.versions.expoSdk}` : ', no Expo'}; workflow: ${s.workflow}; New Architecture: ${s.newArchitecture}`,
    `- package manager: ${s.packageManager} (run binaries with \`${s.runCmd}\`); TypeScript: ${s.typescript ? 'yes' : 'no'}`,
    `- navigation: ${list(s.navigation)}${s.routerAppDir ? ` (routes in ${s.routerAppDir}/)` : ''}; state: ${list(s.state)}; server state: ${list(s.serverState)}`,
    `- styling: ${list(s.styling)}; animation: ${list(s.animation)}; lists: ${list(s.lists)}; images: ${list(s.images)}`,
    `- i18n: ${list(s.i18n.libraries)}${s.i18n.localesDir ? ` (locales in ${s.i18n.localesDir})` : ''}`,
    `- tests: ${s.testing.unit || 'none'}${s.testing.rntl ? ' + RNTL' : ''}${s.testing.e2e.length ? `; e2e: ${s.testing.e2e.join(', ')}` : ''}`,
    `- EAS: ${s.eas.present ? `profiles ${list(s.eas.buildProfiles)}, versions ${s.eas.appVersionSource}` : 'not configured'}; OTA updates: ${s.otaUpdates ? 'yes' : 'no'}`,
    c.isCNG(s) ? '- ios/ and android/ are generated (CNG): native changes go through app config / config plugins; a hook blocks edits there.' : null,
    c.isExpo(s) ? '- packages are installed with `npx expo install` in this project; a hook enforces it.' : null,
    'Full JSON: node ~/.claude/skills/rn-conventions/scripts/detect-stack.js (or .claude/skills/… for a per-project install).',
  ].filter(Boolean).join('\n');
}

c.safe(() => {
  const input = c.readInput();
  const stack = c.getStack(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (!stack) c.ok();
  const root = stack.projectRoot;
  const cfg = c.getConfig(root);
  const out = [];

  if (cfg.sessionStackContext) out.push(summary(stack));

  if (cfg.sessionEnvCheck) {
    const warnings = [nodeCheck(root), depsCheck(root, stack)].filter(Boolean);
    if (warnings.length) out.push(`Environment warnings:\n${warnings.map((w) => `- ${w}`).join('\n')}`);
  }

  const source = input.source || 'startup';
  if (cfg.sessionTypecheckBaseline && stack.typescript && (source === 'startup' || source === 'clear')) {
    c.writeState(c.baselineKey(root), {}); // drop the previous session's baseline
    try {
      const child = spawn(process.execPath, [path.join(__dirname, 'lib', 'baseline.js'), root], { detached: true, stdio: 'ignore', cwd: root });
      child.unref();
    } catch { /* ignore */ }
  }

  if (out.length) process.stdout.write(`${out.join('\n\n')}\n`);
  c.ok();
});
