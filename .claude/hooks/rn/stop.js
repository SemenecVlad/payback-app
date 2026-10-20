#!/usr/bin/env node
'use strict';
/**
 * Stop gate. Runs when Claude is about to finish a turn, only in RN / Expo projects,
 * and only if Claude edited JS/TS files in this session.
 *
 *  stopTypecheck    — new TypeScript errors (compared to the session-start baseline)
 *  stopRelatedTests — `jest --findRelatedTests` for the files edited in this session
 *  stopJunkScan     — console.log / debugger / .only( / localhost / staging URLs in lines added by Claude
 *
 * Anti-loop rules (so the gate can't make agents useless):
 *  - Only problems tied to this session's edits; pre-existing errors are ignored.
 *  - The same set of problems blocks at most once: if Claude stops again without changing them,
 *    the stop is allowed and the user sees a warning instead (e.g. a test needs a product decision,
 *    or the user asked for console.log while debugging).
 *  - At most `stopMaxBlocks` blocks per session.
 *  - Passing state is cached: unchanged files are not re-checked on every turn.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const c = require('./lib/common');

function git(root, args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 * 1024 * 1024 }); }
  catch { return null; }
}

const isTestFile = (f) => /(^|\/)(__tests__|__mocks__|e2e)\/|\.(test|spec)\.[tj]sx?$/.test(f);

function addedLines(root, rel) {
  const tracked = git(root, ['ls-files', '--error-unmatch', '--', rel]);
  if (tracked === null) {
    // untracked new file → all lines are Claude's
    try { return fs.readFileSync(path.join(root, rel), 'utf8').split('\n').map((t, i) => ({ n: i + 1, t })); } catch { return []; }
  }
  const diff = git(root, ['diff', '-U0', 'HEAD', '--', rel]);
  if (!diff) return [];
  const out = [];
  let n = 0;
  for (const line of diff.split('\n')) {
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (h) { n = Number(h[1]); continue; }
    if (line.startsWith('+') && !line.startsWith('+++')) { out.push({ n, t: line.slice(1) }); n++; }
  }
  return out;
}

const JUNK = [
  { re: /\bconsole\.(log|debug|trace)\s*\(/, what: 'console.log', tests: false },
  { re: /^\s*debugger\s*;?\s*$/, what: 'debugger', tests: true },
  { re: /\b(it|test|describe)\.only\s*\(|\b(fit|fdescribe)\s*\(/, what: '.only( focused test', tests: true },
  { re: /https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0)\b/, what: 'localhost URL', tests: false },
  { re: /https?:\/\/[^\s'"`]*(staging|\.stg\.|-stg\b|dev-api|ngrok)/i, what: 'staging/dev URL', tests: false },
];

c.safe(() => {
  const input = c.readInput();
  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const stack = c.getStack(projectDir);
  if (!stack) c.ok();
  const root = stack.projectRoot;
  const cfg = c.getConfig(root);

  const edited = c.getEditedFiles(input.session_id, root).filter((f) => fs.existsSync(path.join(root, f)));
  const code = edited.filter((f) => c.CODE_EXT.test(f) && !/^(ios|android)\//.test(f));
  if (!code.length) c.ok();

  // skip if nothing changed since the last passing check
  const stateKey = `stop:${input.session_id}:${root}`;
  const state = c.readState(stateKey);
  const fingerprint = c.hash(code.map((f) => { try { return f + fs.readFileSync(path.join(root, f), 'utf8'); } catch { return f; } }).join('\0'));
  if (state.passed === fingerprint) c.ok();

  const sections = [];

  if (cfg.stopTypecheck && code.some((f) => /\.tsx?$/.test(f))) {
    const errors = c.typecheck(root, 240000);
    if (errors) {
      const fresh = c.newTypeErrors(root, errors, code);
      if (fresh.length) sections.push(`TypeScript — ${fresh.length} new error(s):\n${c.formatTypeErrors(fresh)}`);
    }
  }

  if (cfg.stopRelatedTests && stack.testing && /jest/.test(String(stack.testing.unit || ''))) {
    const jest = c.localBin(root, 'jest');
    if (jest) {
      const r = c.run(jest, ['--ci', '--silent', '--passWithNoTests', '--findRelatedTests', ...code.map((f) => path.join(root, f))], { cwd: root, timeoutMs: 300000 });
      if (!r.timedOut && r.code !== 0 && r.out) {
        const summary = r.out.split('\n').filter((l) => /●|FAIL|Tests:|Test Suites:|Expected|Received|Error:/.test(l));
        sections.push(`Tests related to edited files are failing:\n${c.tail((summary.length ? summary : r.out.split('\n')).join('\n'), 45)}`);
      }
    }
  }

  if (cfg.stopJunkScan && git(root, ['rev-parse', '--is-inside-work-tree'])) {
    const found = [];
    for (const f of code) {
      const test = isTestFile(f);
      for (const { n, t } of addedLines(root, f)) {
        if (/^\s*(\/\/|\*|\/\*)/.test(t)) continue;
        for (const j of JUNK) if ((!test || j.tests) && j.re.test(t)) found.push(`${f}:${n} ${j.what}: ${t.trim().slice(0, 100)}`);
      }
    }
    if (found.length) sections.push(`Leftovers in lines added this session:\n${found.slice(0, 20).join('\n')}${found.length > 20 ? `\n… and ${found.length - 20} more` : ''}`);
  }

  if (!sections.length) {
    c.writeState(stateKey, { ...state, passed: fingerprint });
    c.ok();
  }

  const signature = c.hash(sections.join('\n').replace(/:\d+/g, ''));
  const blocks = state.blocks || 0;
  if (signature === state.lastSignature || blocks >= cfg.stopMaxBlocks) {
    // Already reported once and unchanged (or block budget used up): let Claude finish, tell the user.
    c.writeState(stateKey, { ...state, lastSignature: signature });
    process.stdout.write(JSON.stringify({ systemMessage: `[rn-hooks] Finished with open issues:\n${sections.join('\n\n').slice(0, 3000)}` }));
    process.exit(0);
  }

  c.writeState(stateKey, { ...state, blocks: blocks + 1, lastSignature: signature });
  c.blockStop(
    `Quality gate found problems in files you changed this session:\n\n${sections.join('\n\n')}\n\n` +
    'Fix the ones caused by your changes. Do not weaken or skip tests, add @ts-ignore/any, or delete assertions just to pass. ' +
    'If something is intentional (the user asked for debug logs, a localhost URL is a dev-only config) or a failing test needs a decision from the user, ' +
    'say so briefly in your reply and stop — this gate does not block twice for the same problems.',
  );
});
