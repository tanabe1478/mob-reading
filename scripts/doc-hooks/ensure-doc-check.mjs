#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const reminderScript = path.resolve('scripts/doc-hooks/doc-reminder.mjs');

function runDocReminder(extraArgs = []) {
  const child = spawnSync(process.execPath, [reminderScript, ...extraArgs], {
    stdio: 'inherit',
  });
  if (child.error) {
    throw child.error;
  }
  if (child.status && child.status !== 0) {
    process.exit(child.status);
  }
}

// default: let doc-reminder auto-detect changed files via git
runDocReminder();
console.log('doc-reminder completed (doc-check)');
