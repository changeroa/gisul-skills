import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function assertCanaryActions({ events, input, output, mockEvents }) {
  assert.ok(input?.trim(), 'Missing unpredictable file probe');
  const reads = events.filter(event => event.method === 'item/completed').map(event => event.params.item)
    .filter(item => ['commandExecution', 'command_execution'].includes(item.type) && item.status === 'completed' && item.exitCode === 0 && String(item.aggregatedOutput ?? item.output ?? '').trim() === input.trim());
  assert.ok(reads.length, 'Model must actually read the unpredictable workspace file through a successful command');
  assert.equal(output, input, 'Model must actually write the copied workspace file');
  const creates = mockEvents.filter(event => event.phase === 'applied' && event.tool === 'save_issue');
  assert.equal(creates.length, 1, 'Exactly one fixture write must actually be applied');
  assert.ok(mockEvents.some(event => event.phase === 'applied' && event.tool === 'get_issue' && event.result.id === creates[0].result.id && event.result.title === 'Evaluation write canary'), 'Created issue must be read back');
  assert.equal(events.filter(event => event.method === 'evaluation/interactiveRequestRejected').length, 0);
  return { fileRead: true, fileWrite: true, issueCreate: true, issueRead: true, inputDigest: digest(input), outputDigest: digest(output), readItemIds: reads.map(item => item.id) };
}

export async function canaryFingerprint(reader) {
  const files = ['runtime.mjs', 'reader.mjs', 'mock-linear.mjs', 'canary.mjs', 'canary-proof.mjs', 'io.mjs', 'profiles/eval-baseline.config.toml', 'profiles/eval-candidate.config.toml'];
  const hashes = Object.fromEntries(await Promise.all(files.map(async file => [file, digest(await readFile(join(HERE, file)))])));
  const binary = await realpath(execFileSync('which', ['codex'], { encoding: 'utf8' }).trim());
  const binaries = {};
  for (const name of ['codex', 'codex-code-mode-host']) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(join(dirname(binary), name))) hash.update(chunk);
    binaries[name] = hash.digest('hex');
  }
  return { model: 'gpt-6-astra', effort: 'max', codexVersion: execFileSync('codex', ['--version'], { encoding: 'utf8' }).trim(), binaries, hashes,
    reader: { endpoint: reader.endpoint, commit: reader.commit, release: reader.release, bundleHash: digest(await readFile(reader.bundle)), loaderHash: digest(await readFile(reader.loader)) } };
}

export async function requireCanary(path, reader) {
  assert.ok(path, 'A successful file/read-write and mock-write canary is required: --canary RECEIPT_JSON');
  const receipt = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(receipt.kind, 'infrastructure_capability_canary');
  assert.equal(receipt.passed, true, 'Capability canary did not pass');
  for (const key of ['fileRead', 'fileWrite', 'issueCreate', 'issueRead']) assert.equal(receipt.checks?.[key], true, `Canary is missing ${key} evidence`);
  assert.deepEqual(receipt.fingerprint, await canaryFingerprint(reader), 'Canary no longer matches the execution code, model, CLI or reader');
  return { path, receiptHash: digest(await readFile(path)), threadId: receipt.threadId, fingerprint: receipt.fingerprint };
}
