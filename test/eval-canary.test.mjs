import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assertCanaryActions, canaryFingerprint, requireCanary } from '../eval/canary-proof.mjs';

function actions() {
  return { input: 'unpredictable-fixture-value\n', output: 'unpredictable-fixture-value\n',
    events: [{ method: 'item/completed', params: { item: { id: 'command-1', type: 'commandExecution', status: 'completed', exitCode: 0, aggregatedOutput: 'unpredictable-fixture-value\n' } } }],
    mockEvents: [{ phase: 'applied', tool: 'save_issue', result: { id: 'fixture-1' } }, { phase: 'applied', tool: 'get_issue', result: { id: 'fixture-1', title: 'Evaluation write canary' } }] };
}

test('a completed model turn or copied output alone does not prove model file access', () => {
  for (const events of [[], [{ method: 'item/completed', params: { item: { type: 'agentMessage', text: 'I read unpredictable-fixture-value' } } }]]) {
    assert.throws(() => assertCanaryActions({ ...actions(), events }), /actually read/);
  }
  const failed = actions(); failed.events[0].params.item.exitCode = 1;
  assert.throws(() => assertCanaryActions(failed), /actually read/);
  assert.throws(() => assertCanaryActions({ ...actions(), output: 'different\n' }), /actually write/);
  assert.throws(() => assertCanaryActions({ ...actions(), mockEvents: [] }), /fixture write/);
  const noRead = actions(); noRead.mockEvents.pop();
  assert.throws(() => assertCanaryActions(noRead), /read back/);
  assert.deepEqual(assertCanaryActions(actions()).readItemIds, ['command-1']);
});

test('full experiments reject a missing, old write-only or failed canary', async t => {
  const root = await mkdtemp(join(tmpdir(), 'gisul-canary-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'receipt.json');
  await assert.rejects(requireCanary(undefined, {}), /--canary/);
  await writeFile(file, JSON.stringify({ kind: 'infrastructure_write_canary', passed: true }));
  await assert.rejects(requireCanary(file, {}), /infrastructure_capability_canary/);
  await writeFile(file, JSON.stringify({ kind: 'infrastructure_capability_canary', passed: false }));
  await assert.rejects(requireCanary(file, {}), /did not pass/);
  await writeFile(file, JSON.stringify({ kind: 'infrastructure_capability_canary', passed: true, checks: { issueCreate: true, issueRead: true } }));
  await assert.rejects(requireCanary(file, {}), /fileRead/);
});

test('a successful proof is bound to both CLI binaries and the content reader', async t => {
  const root = await mkdtemp(join(tmpdir(), 'gisul-canary-runtime-test-'));
  const previous = process.env.PATH;
  t.after(async () => { process.env.PATH = previous; await rm(root, { recursive: true, force: true }); });
  await writeFile(join(root, 'codex'), '#!/bin/sh\nprintf "codex-cli fixture\\n"\n', { mode: 0o700 });
  await writeFile(join(root, 'codex-code-mode-host'), 'fixture companion');
  await writeFile(join(root, 'reader'), 'fixture reader');
  await writeFile(join(root, 'loader'), 'fixture loader');
  process.env.PATH = root + ':' + previous;
  const reader = { bundle: join(root, 'reader'), loader: join(root, 'loader'), endpoint: 'https://reader.invalid/mcp', commit: 'a'.repeat(40), release: '20260922.1' };
  const path = join(root, 'receipt.json');
  const receipt = { kind: 'infrastructure_capability_canary', passed: true, checks: assertCanaryActions(actions()), fingerprint: await canaryFingerprint(reader), threadId: 'fixture-thread' };
  await writeFile(path, JSON.stringify(receipt));
  assert.equal((await requireCanary(path, reader)).threadId, 'fixture-thread');
  await assert.rejects(requireCanary(path, { ...reader, commit: 'b'.repeat(40) }), /no longer matches/);
  await writeFile(join(root, 'codex-code-mode-host'), 'changed companion');
  await assert.rejects(requireCanary(path, reader), /no longer matches/);
});
