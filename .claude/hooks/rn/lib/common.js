'use strict';
/**
 * Shared helpers for RN Claude Kit hooks. Zero dependencies.
 * Every hook FAILS OPEN: an internal error never blocks work.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

// ---------- input / output ----------

function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

/** PreToolUse: deny the tool call; the reason is shown to Claude. */
const deny = (reason) => emit({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[rn-hooks] ${reason}` },
});

/** PreToolUse: ask the user to confirm this tool call. */
const ask = (reason) => emit({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `[rn-hooks] ${reason}` },
});

/** Non-blocking factual context for Claude (PostToolUse / SessionStart). */
const addContext = (eventName, text) => emit({
  hookSpecificOutput: { hookEventName: eventName, additionalContext: String(text).slice(0, 9500) },
});

/** PostToolUse: report a problem to Claude. Exit 2 → stderr goes to Claude; the edit itself stays. */
function feedback(text) {
  process.stderr.write(`[rn-hooks] ${String(text).slice(0, 9500)}\n`);
  process.exit(2);
}

/** Stop / SubagentStop: keep Claude working, with this reason. */
const blockStop = (reason) => emit({ decision: 'block', reason: `[rn-hooks] ${String(reason).slice(0, 9500)}` });

const ok = () => process.exit(0);

/** Wrap a hook body so any unexpected error fails open. */
function safe(fn) {
  try {
    fn();
  } catch (e) {
    if (process.env.RN_HOOKS_DEBUG) process.stderr.write(`[rn-hooks] internal error: ${e && e.stack}\n`);
    process.exit(0);
  }
}

// ---------- stack detection ----------

function findDetector() {
  const candidates = [
    // <.claude>/hooks/rn/lib → <.claude>/skills (both user-level and project-level installs)
    path.join(__dirname, '..', '..', '..', 'skills', 'rn-conventions', 'scripts', 'detect-stack.js'),
    path.join(os.homedir(), '.claude', 'skills', 'rn-conventions', 'scripts', 'detect-stack.js'),
    process.env.CLAUDE_PROJECT_DIR && path.join(process.env.CLAUDE_PROJECT_DIR, '.claude', 'skills', 'rn-conventions', 'scripts', 'detect-stack.js'),
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || null;
}

const stackCache = new Map();
/** Detector report for the RN project around `dir`, or null (not RN / detector missing). */
function getStack(dir) {
  const start = dir || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (stackCache.has(start)) return stackCache.get(start);
  let result = null;
  const detector = findDetector();
  if (detector) {
    try {
      const { detectStack } = require(detector);
      const r = detectStack(start);
      result = r && r.isReactNative ? r : null;
    } catch { result = null; }
  }
  stackCache.set(start, result);
  return result;
}

const isExpo = (s) => Boolean(s && s.versions && s.versions.expo);
const isCNG = (s) => Boolean(s && typeof s.workflow === 'string' && s.workflow.startsWith('expo-managed'));

// ---------- config ----------

const DEFAULTS = {
  guardNativeDirs: true,
  guardExpoInstall: true,
  guardSecrets: true,
  guardCloudCommands: true,
  guardGitPush: true,
  guardLockfiles: true,
  postFormat: true,
  postLint: true,
  postTypecheck: true,
  postExpoInstallCheck: true,
  postAppConfigCheck: true,
  stopTypecheck: true,
  stopRelatedTests: true,
  stopJunkScan: true,
  stopMaxBlocks: 3,
  subagentTestRunnerCheck: true,
  sessionEnvCheck: true,
  sessionStackContext: true,
  sessionTypecheckBaseline: true,
  notify: true,
  notifySound: true,
};

/** DEFAULTS ← <hooks>/rn/config.json ← <project>/.claude/rn-hooks.json */
function getConfig(projectRoot) {
  const cfg = { ...DEFAULTS };
  const files = [
    path.join(__dirname, '..', 'config.json'),
    process.env.CLAUDE_PROJECT_DIR && path.join(process.env.CLAUDE_PROJECT_DIR, '.claude', 'rn-hooks.json'),
    projectRoot && path.join(projectRoot, '.claude', 'rn-hooks.json'),
  ].filter(Boolean);
  for (const f of [...new Set(files)]) {
    try { Object.assign(cfg, JSON.parse(fs.readFileSync(f, 'utf8'))); } catch { /* missing / invalid → ignore */ }
  }
  return cfg;
}

// ---------- processes ----------

/** Binary from node_modules/.bin, searching from projectRoot upwards (monorepos). */
function localBin(projectRoot, name) {
  let d = projectRoot;
  while (d) {
    const p = path.join(d, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name);
    if (fs.existsSync(p)) return p;
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

function run(cmd, args, { cwd, timeoutMs = 60000, env } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CI: '1', FORCE_COLOR: '0', NO_COLOR: '1', EXPO_NO_TELEMETRY: '1', ...env },
    shell: process.platform === 'win32',
  });
  return {
    code: r.status,
    timedOut: Boolean(r.error && r.error.code === 'ETIMEDOUT'),
    missing: Boolean(r.error && r.error.code === 'ENOENT'),
    out: `${r.stdout || ''}${r.stderr ? `\n${r.stderr}` : ''}`.trim(),
  };
}

function tail(text, lines = 40) {
  const arr = String(text).split('\n');
  return arr.length > lines ? ['…', ...arr.slice(-lines)].join('\n') : String(text);
}

// ---------- typecheck (shared by post-tool-use, stop, session-start) ----------

function tsBuildInfo(projectRoot) {
  return path.join(stateDir(), `tsbuildinfo-${hash(projectRoot)}`);
}

/**
 * Runs tsc --noEmit (incremental, build info kept in tmp) and returns parsed errors:
 * [{ file (relative), line, code, message, key }] — `key` ignores line numbers so baselines survive edits.
 * Returns null if tsc isn't available or timed out.
 */
function typecheck(projectRoot, timeoutMs = 120000) {
  if (!fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) return null;
  const tsc = localBin(projectRoot, 'tsc');
  if (!tsc) return null;
  const r = run(tsc, ['--noEmit', '--pretty', 'false', '--incremental', '--tsBuildInfoFile', tsBuildInfo(projectRoot)], { cwd: projectRoot, timeoutMs });
  if (r.timedOut || r.missing) return null;
  // Some tsconfigs (composite / conflicting options) reject our flags — retry plain.
  let out = r.out;
  if (/TS5\d{3}/.test(out) && !/\(\d+,\d+\): error/.test(out)) {
    const r2 = run(tsc, ['--noEmit', '--pretty', 'false'], { cwd: projectRoot, timeoutMs });
    if (r2.timedOut || r2.missing) return null;
    out = r2.out;
  }
  const errors = [];
  for (const line of out.split('\n')) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (!m) continue;
    const file = path.relative(projectRoot, path.resolve(projectRoot, m[1])).split(path.sep).join('/');
    errors.push({ file, line: Number(m[2]), code: m[4], message: m[5], key: `${file}|${m[4]}|${m[5]}` });
  }
  return errors;
}

function baselineKey(projectRoot) {
  return `ts-baseline:${projectRoot}`;
}

/** Errors not present in the session-start baseline. With no baseline → only errors in `focusFiles`. */
function newTypeErrors(projectRoot, errors, focusFiles) {
  const base = readState(baselineKey(projectRoot));
  if (Array.isArray(base.keys)) {
    const set = new Set(base.keys);
    return errors.filter((e) => !set.has(e.key));
  }
  const focus = new Set(focusFiles || []);
  return errors.filter((e) => focus.has(e.file));
}

function formatTypeErrors(errors, max = 25) {
  const lines = errors.slice(0, max).map((e) => `${e.file}:${e.line} ${e.code} ${e.message}`);
  if (errors.length > max) lines.push(`… and ${errors.length - max} more`);
  return lines.join('\n');
}

// ---------- state ----------

function stateDir() {
  const d = path.join(os.tmpdir(), 'rn-claude-hooks');
  try { fs.mkdirSync(d, { recursive: true }); } catch { /* ignore */ }
  return d;
}
function hash(s) {
  return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 16);
}
function readState(key) {
  try { return JSON.parse(fs.readFileSync(path.join(stateDir(), `${hash(key)}.json`), 'utf8')); } catch { return {}; }
}
function writeState(key, value) {
  try { fs.writeFileSync(path.join(stateDir(), `${hash(key)}.json`), JSON.stringify(value)); } catch { /* ignore */ }
}

/** Files Claude edited in this session (recorded by post-tool-use), relative to projectRoot. */
function sessionKey(sessionId, projectRoot) {
  return `edited:${sessionId || 'nosession'}:${projectRoot}`;
}
function getEditedFiles(sessionId, projectRoot) {
  const s = readState(sessionKey(sessionId, projectRoot));
  return Array.isArray(s.files) ? s.files : [];
}
function addEditedFile(sessionId, projectRoot, rel) {
  const files = new Set(getEditedFiles(sessionId, projectRoot));
  files.add(rel);
  writeState(sessionKey(sessionId, projectRoot), { files: [...files] });
}

// ---------- paths ----------

/** `p` relative to root with forward slashes; null if outside root. */
function relInside(root, p) {
  if (!root || !p) return null;
  const rel = path.relative(root, path.resolve(root, p));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function toolFilePath(input) {
  const ti = input.tool_input || {};
  return ti.file_path || ti.notebook_path || null;
}

const CODE_EXT = /\.(tsx?|jsx?|mjs|cjs)$/;

module.exports = {
  readInput, deny, ask, addContext, feedback, blockStop, ok, safe,
  getStack, isExpo, isCNG, getConfig,
  localBin, run, tail,
  typecheck, baselineKey, newTypeErrors, formatTypeErrors,
  readState, writeState, hash, stateDir,
  getEditedFiles, addEditedFile,
  relInside, toolFilePath, CODE_EXT,
};
