#!/usr/bin/env node
'use strict';
/**
 * PostToolUse checks. Matcher: Edit|Write|MultiEdit
 * Runs only inside React Native / Expo projects.
 *
 *  - records the edited file for this session (used by the Stop gate)
 *  postFormat           — Prettier (or Biome) --write on the edited JS/TS file
 *  postLint             — ESLint (or Biome lint) on the edited file, errors only
 *  postTypecheck        — tsc errors in the edited file that weren't there at session start
 *  postExpoInstallCheck — after editing package.json in an Expo project: `expo install --check`
 *  postAppConfigCheck   — after editing app.json / app.config.*: `expo config` must resolve; reminds about native rebuilds
 *
 * Problems are sent back to Claude (exit 2). The edit itself is never undone.
 */
const fs = require('fs');
const path = require('path');
const c = require('./lib/common');

c.safe(() => {
  const input = c.readInput();
  const file = c.toolFilePath(input);
  if (!file) c.ok();
  const abs = path.resolve(input.cwd || process.cwd(), file);
  if (!fs.existsSync(abs)) c.ok();

  const stack = c.getStack(path.dirname(abs));
  if (!stack) c.ok();
  const root = stack.projectRoot;
  const rel = c.relInside(root, abs);
  if (!rel || rel.split('/').includes('node_modules')) c.ok();
  const cfg = c.getConfig(root);

  c.addEditedFile(input.session_id, root, rel);

  const problems = [];
  const notes = [];

  // ---------- JS / TS files ----------
  if (c.CODE_EXT.test(rel) && !/^(ios|android)\//.test(rel)) {
    const prettier = c.localBin(root, 'prettier');
    const eslint = c.localBin(root, 'eslint');
    const biome = c.localBin(root, 'biome');

    if (cfg.postFormat) {
      const before = fs.readFileSync(abs, 'utf8');
      if (prettier) c.run(prettier, ['--write', '--log-level', 'warn', abs], { cwd: root, timeoutMs: 20000 });
      else if (biome) c.run(biome, ['format', '--write', abs], { cwd: root, timeoutMs: 20000 });
      if (fs.readFileSync(abs, 'utf8') !== before) {
        notes.push(`${rel} was reformatted by ${prettier ? 'Prettier' : 'Biome'} after this edit; read it again before the next edit to this file.`);
      }
    }

    if (cfg.postLint) {
      if (eslint) {
        const r = c.run(eslint, ['--quiet', '--no-color', abs], { cwd: root, timeoutMs: 45000 });
        // exit 1 = lint errors; exit 2 = config/crash (don't bother Claude with broken tooling)
        if (r.code === 1 && r.out) problems.push(`ESLint errors in ${rel}:\n${c.tail(r.out, 30)}`);
      } else if (biome) {
        const r = c.run(biome, ['lint', '--diagnostic-level=error', abs], { cwd: root, timeoutMs: 30000 });
        if (r.code === 1 && r.out) problems.push(`Biome lint errors in ${rel}:\n${c.tail(r.out, 30)}`);
      }
    }

    if (cfg.postTypecheck && /\.tsx?$/.test(rel)) {
      const errors = c.typecheck(root, 90000);
      if (errors) {
        const mine = c.newTypeErrors(root, errors, [rel]).filter((e) => e.file === rel);
        if (mine.length) problems.push(`TypeScript errors in ${rel} (new since session start):\n${c.formatTypeErrors(mine, 15)}`);
      }
    }
  }

  // ---------- package.json ----------
  if (rel === 'package.json' && cfg.postExpoInstallCheck && c.isExpo(stack)) {
    const expo = c.localBin(root, 'expo');
    if (expo) {
      const r = c.run(expo, ['install', '--check'], { cwd: root, timeoutMs: 60000 });
      if (r.code !== 0 && !r.timedOut && r.out) {
        problems.push(`Dependencies don't match Expo SDK ${stack.versions.expoSdk || ''} after editing package.json:\n${c.tail(r.out, 25)}\nFix with \`npx expo install --fix\` (or \`npx expo install <pkg>\` for specific packages), then reinstall.`);
      }
    }
    notes.push('package.json changed — run the package manager install for it to take effect. New packages with native code need a new dev build (not deliverable via OTA).');
  }

  // ---------- app config ----------
  if (cfg.postAppConfigCheck && c.isExpo(stack) && /^(app\.json|app\.config\.(ts|js|mjs|cjs))$/.test(rel)) {
    const expo = c.localBin(root, 'expo');
    if (expo) {
      const r = c.run(expo, ['config', '--type', 'public', '--json'], { cwd: root, timeoutMs: 45000 });
      if (r.code !== 0 && !r.timedOut) problems.push(`App config no longer resolves after editing ${rel}:\n${c.tail(r.out, 25)}`);
    }
    notes.push(`${rel} changed. Native-affecting keys (plugins, ios/android sections, permissions, bundle IDs, icons, splash) need \`npx expo prebuild --clean\` / a new dev build and a new store build; they can't ship via OTA.`);
  }

  if (problems.length) c.feedback([...problems, ...notes].join('\n\n'));
  if (notes.length) c.addContext('PostToolUse', notes.join('\n'));
  c.ok();
});
