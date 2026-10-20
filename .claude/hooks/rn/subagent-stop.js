#!/usr/bin/env node
'use strict';
/**
 * SubagentStop gate — subagentTestRunnerCheck.
 * The `test-runner` agent may not report back without having actually run the tests once.
 *
 * Never blocks when:
 *  - the finishing agent isn't test-runner (or its type is unknown),
 *  - the project has no unit-test runner (test-runner is told to just report that),
 *  - it already blocked once for this agent (stop_hook_active), or the transcript can't be read.
 */
const fs = require('fs');
const c = require('./lib/common');

const RAN_TESTS = /"command"\s*:\s*"[^"]*\b(jest|vitest|(npm|yarn|pnpm|bun)( run)? test|npx test|expo test)\b/;

c.safe(() => {
  const input = c.readInput();
  const agent = String(input.agent_type || input.subagent_type || '');
  if (!/test-runner/.test(agent)) c.ok();
  if (input.stop_hook_active) c.ok();

  const stack = c.getStack(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
  if (!stack) c.ok();
  const cfg = c.getConfig(stack.projectRoot);
  if (!cfg.subagentTestRunnerCheck) c.ok();
  if (!stack.testing || !stack.testing.unit) c.ok();

  const transcript = input.agent_transcript_path || input.transcript_path;
  let text = '';
  try { text = fs.readFileSync(transcript, 'utf8'); } catch { c.ok(); }
  if (RAN_TESTS.test(text)) c.ok();

  c.blockStop(`test-runner is finishing without having run the tests. Run them (${stack.testing.testScript ? `the "test" script: ${stack.testing.testScript}` : `${stack.runCmd} jest`} with --ci) and base the report on the actual result.`);
});
