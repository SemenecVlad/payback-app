#!/usr/bin/env node
'use strict';
/**
 * Notification — desktop notification when Claude is waiting for you (permission prompt, idle input).
 * macOS: osascript · Linux: notify-send · otherwise: terminal bell. Works in any project.
 */
const { spawnSync } = require('child_process');
const c = require('./lib/common');

c.safe(() => {
  const input = c.readInput();
  const cfg = c.getConfig(process.env.CLAUDE_PROJECT_DIR || input.cwd);
  if (!cfg.notify) c.ok();

  const title = 'Claude Code';
  const message = String(input.message || 'Claude is waiting for your input').slice(0, 200);
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  if (process.platform === 'darwin') {
    const sound = cfg.notifySound ? ' sound name "Glass"' : '';
    spawnSync('osascript', ['-e', `display notification "${esc(message)}" with title "${title}"${sound}`], { timeout: 5000 });
  } else if (process.platform === 'linux' && spawnSync('which', ['notify-send']).status === 0) {
    spawnSync('notify-send', ['-a', title, title, message], { timeout: 5000 });
  } else if (cfg.notifySound) {
    process.stderr.write('\x07');
  }
  c.ok();
});
