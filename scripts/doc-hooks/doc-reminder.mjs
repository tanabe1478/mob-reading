#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const triggersPath = path.resolve('docs/specs/triggers.json');

function loadTriggers() {
  const raw = fs.readFileSync(triggersPath, 'utf8');
  const data = JSON.parse(raw);
  return Object.entries(data).map(([prefix, specs]) => ({ prefix, specs }));
}

function findSpecs(changedFiles, triggers) {
  const matched = new Set();
  for (const file of changedFiles) {
    for (const { prefix, specs } of triggers) {
      if (file.startsWith(prefix)) {
        specs.forEach((s) => matched.add(s));
      }
    }
  }
  return Array.from(matched);
}

function isGitRepository() {
  const proc = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
  });
  return proc.status === 0 && proc.stdout.trim() === 'true';
}

function defaultChangedFiles() {
  if (!isGitRepository()) {
    console.warn('Not a git repository; skipping doc-reminder auto-detect.');
    return [];
  }

  try {
    const output = execSync('git diff --name-only --diff-filter=ACMRT HEAD', { encoding: 'utf8' }).trim();
    if (!output) {
      return [];
    }
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    console.warn('Unable to detect changed files via git diff:', error.message);
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  const filesFlagIndex = args.indexOf('--files');
  let changedFiles = [];

  if (filesFlagIndex !== -1) {
    changedFiles = args.slice(filesFlagIndex + 1).map((f) => f.trim()).filter(Boolean);
  }

  if (changedFiles.length === 0) {
    changedFiles = defaultChangedFiles();
  }

  if (changedFiles.length === 0) {
    console.log('No changed files detected.');
    return;
  }

  const triggers = loadTriggers();
  const specs = findSpecs(changedFiles, triggers);

  if (specs.length === 0) {
    console.log('No matching specs.');
    return;
  }

  console.log('Suggested specs to open/update:');
  for (const spec of specs) {
    console.log(`- ${spec}`);
  }
}

main();
