#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const cli = join(root, 'bin/archify.mjs');
const cases = [
  ['architecture', 'web-app.architecture.json'],
  ['workflow', 'agent-tool-call.workflow.json'],
  ['sequence', 'cache-miss-request.sequence.json'],
  ['dataflow', 'product-analytics.dataflow.json'],
  ['lifecycle', 'agent-run.lifecycle.json'],
];
const directory = await mkdtemp(join(tmpdir(), 'archify-packaged-'));

function run(args, type, stage) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw Object.assign(new Error(result.error?.message || result.stderr || result.stdout || `Exit ${result.status}`), { type, stage });
  }
  return result.stdout;
}

function checked(args, type, stage) {
  try {
    const receipt = JSON.parse(run(args, type, stage));
    assert.equal(receipt.ok, true);
    assert.ok(receipt.checks.length >= 9 && receipt.checks.every(check => check.ok));
    assert.equal(receipt.composition.profile, 'showcase');
    assert.deepEqual(receipt.composition.summary, { errors: 0, warnings: 0 });
    return receipt;
  } catch (error) {
    throw Object.assign(error, { type, stage });
  }
}

let receipt;
try {
  const diagrams = [];
  for (const [type, file] of cases) {
    const input = join(root, 'examples', file), output = join(directory, `${type}.html`);
    checked(['validate', type, input, '--json'], type, 'validate');
    run(['render', type, input, output], type, 'render');
    const artifact = checked(['check', output], type, 'artifact');
    const bytes = await readFile(output);
    assert.match(bytes.toString('utf8'), /<svg\b/i);
    diagrams.push({ type, artifact_checks: artifact.checks.length, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const invalid = join(directory, 'invalid.json');
  await writeFile(invalid, '{}\n');
  const rejected = spawnSync(process.execPath, [cli, 'validate', 'architecture', invalid, '--json'], { cwd: root, encoding: 'utf8' });
  assert.ok(!rejected.error && rejected.status !== null && rejected.status !== 0, 'Malformed input must be rejected');
  receipt = { passed: true, diagrams, malformed_rejected: true };
} catch (error) {
  receipt = { passed: false, type: error.type ?? null, stage: error.stage ?? 'setup', error: error.message };
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
console.log(JSON.stringify({ ...receipt, cleanup: { directory, removed: true } }, null, 2));
