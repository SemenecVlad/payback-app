#!/usr/bin/env node
/**
 * check-locales.js — compare JSON translation files and report missing / extra / empty keys,
 * plus keys used in code that don't exist in the base locale.
 *
 * Usage:
 *   node check-locales.js <localesDir> [--base en] [--src src] [--fn t]
 *
 * Supports layouts:
 *   <dir>/en.json, <dir>/de.json                      (one file per locale)
 *   <dir>/en/common.json, <dir>/de/common.json        (namespaces per locale folder)
 *   <dir>/en/translation.json                         (i18next default)
 * Nested objects are flattened to dot keys ("settings.title").
 * i18next plural suffixes (_one, _other, _zero, _few, _many, _two) are treated as one base key
 * when checking code usage.
 *
 * Read-only. Exit code 1 if anything is missing.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('--')) {
  console.error('Usage: node check-locales.js <localesDir> [--base en] [--src src] [--fn t]');
  process.exit(2);
}
const dir = path.resolve(args[0]);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i > -1 && args[i + 1] ? args[i + 1] : def;
};

function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}
function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error(`✖ Invalid JSON: ${p} — ${e.message}`); process.exitCode = 1; return {}; }
}

// ---- load locales ----
const locales = {};
for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith('.json')) {
    locales[entry.name.replace(/\.json$/, '')] = flatten(readJSON(path.join(dir, entry.name)));
  } else if (entry.isDirectory()) {
    const files = fs.readdirSync(path.join(dir, entry.name)).filter((f) => f.endsWith('.json'));
    if (!files.length) continue;
    const merged = {};
    for (const f of files) {
      const ns = f.replace(/\.json$/, '');
      const flat = flatten(readJSON(path.join(dir, entry.name, f)));
      const single = files.length === 1 || ns === 'translation';
      for (const [k, v] of Object.entries(flat)) merged[single ? k : `${ns}:${k}`] = v;
    }
    locales[entry.name] = merged;
  }
}

const names = Object.keys(locales);
if (!names.length) { console.error(`No locale JSON files found in ${dir}`); process.exit(2); }

const base = opt('base', names.includes('en') ? 'en' : names.includes('en-US') ? 'en-US' : names[0]);
if (!locales[base]) { console.error(`Base locale "${base}" not found. Available: ${names.join(', ')}`); process.exit(2); }
const baseKeys = new Set(Object.keys(locales[base]));

let problems = 0;
console.log(`Locales: ${names.join(', ')}  (base: ${base}, ${baseKeys.size} keys)\n`);

for (const loc of names) {
  if (loc === base) continue;
  const keys = new Set(Object.keys(locales[loc]));
  const missing = [...baseKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !baseKeys.has(k));
  const empty = [...keys].filter((k) => locales[loc][k] === '' || locales[loc][k] == null);
  const untranslated = [...keys].filter((k) => baseKeys.has(k) && typeof locales[loc][k] === 'string'
    && locales[loc][k].length > 3 && locales[loc][k] === locales[base][k]);
  if (!missing.length && !extra.length && !empty.length && !untranslated.length) { console.log(`✔ ${loc}: complete`); continue; }
  console.log(`● ${loc}:`);
  if (missing.length) { problems += missing.length; console.log(`  missing (${missing.length}):\n    ${missing.join('\n    ')}`); }
  if (empty.length) { problems += empty.length; console.log(`  empty (${empty.length}):\n    ${empty.join('\n    ')}`); }
  if (extra.length) console.log(`  extra, not in base (${extra.length}):\n    ${extra.join('\n    ')}`);
  if (untranslated.length) console.log(`  identical to base — maybe untranslated (${untranslated.length}):\n    ${untranslated.join('\n    ')}`);
}
const emptyBase = [...baseKeys].filter((k) => locales[base][k] === '' || locales[base][k] == null);
if (emptyBase.length) { problems += emptyBase.length; console.log(`● ${base} (base) empty values:\n    ${emptyBase.join('\n    ')}`); }

// ---- keys used in code ----
const srcDir = path.resolve(opt('src', fs.existsSync('src') ? 'src' : '.'));
const fn = opt('fn', 't');
const callRe = new RegExp(`(?:^|[^\\w.])(?:${fn}|i18n\\.t|i18next\\.t)\\(\\s*['"\`]([^'"\`$]+)['"\`]`, 'g');
const pluralRe = /_(zero|one|two|few|many|other)$/;
const baseKeysNoPlural = new Set([...baseKeys].map((k) => k.replace(pluralRe, '')));
const used = new Map();

function walk(d) {
  let entries = [];
  try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (['node_modules', '.git', 'ios', 'android', '.expo', 'dist', 'build', 'coverage'].includes(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
      const text = fs.readFileSync(p, 'utf8');
      let m;
      while ((m = callRe.exec(text))) {
        if (!used.has(m[1])) used.set(m[1], path.relative(process.cwd(), p));
      }
    }
  }
}
walk(srcDir);

const missingInBase = [...used.entries()].filter(([k]) => {
  const plain = k.includes(':') ? k.split(':').slice(1).join(':') : k;
  return !baseKeys.has(k) && !baseKeys.has(plain) && !baseKeysNoPlural.has(k) && !baseKeysNoPlural.has(plain);
});
console.log(`\nCode: ${used.size} static keys found via ${fn}('…') in ${path.relative(process.cwd(), srcDir) || '.'}`);
if (missingInBase.length) {
  problems += missingInBase.length;
  console.log(`● used in code but missing in ${base} (${missingInBase.length}):`);
  for (const [k, f] of missingInBase) console.log(`    ${k}   ← ${f}`);
} else {
  console.log('✔ all statically used keys exist in base');
}
const usedSet = new Set([...used.keys()].flatMap((k) => [k, k.split(':').slice(1).join(':')]));
const unused = [...baseKeysNoPlural].filter((k) => !usedSet.has(k) && !usedSet.has(k.split(':').slice(1).join(':')));
if (unused.length) console.log(`○ possibly unused in base (${unused.length}) — verify; dynamic keys aren't detected`);

console.log(problems ? `\n✖ ${problems} problem(s)` : '\n✔ no problems');
process.exit(problems ? 1 : 0);
