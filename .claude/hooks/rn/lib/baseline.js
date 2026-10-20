#!/usr/bin/env node
'use strict';
/**
 * Background job started by session-start.js: records the TypeScript errors that already exist,
 * so post-tool-use / stop only report errors introduced during the session.
 * Usage: node baseline.js <projectRoot>
 */
const c = require('./common');

c.safe(() => {
  const root = process.argv[2];
  if (!root) c.ok();
  const errors = c.typecheck(root, 600000);
  if (errors) c.writeState(c.baselineKey(root), { keys: [...new Set(errors.map((e) => e.key))], at: Date.now() });
  c.ok();
});
