import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { eventJournal, requireDiskSpace } from '../eval/io.mjs';
import { classifyFailure, stopReason } from '../eval/run.mjs';

test('asynchronous journal ENOSPC reaches the model stop handler and close settles', async () => {
  const error = Object.assign(new Error('No space left'), { code: 'ENOSPC' });
  const failures = [];
  const journal = eventJournal('/fixture', e => failures.push(e), () => new Writable({ write(chunk, encoding, callback) { setImmediate(() => callback(error)); } }));
  await assert.rejects(journal.write({ method: 'item/completed' }), error);
  await assert.rejects(journal.close(), error);
  assert.deepEqual(failures, [error]);
  await assert.rejects(journal.write({ method: 'late' }), error);
  for (const stage of ['preflight', 'execution', 'evidence']) assert.equal(classifyFailure(error, stage), 'storage');
  assert.equal(stopReason([{ failure: { type: 'storage' } }], 100), 'storage_failure');
});

test('successful journal close waits for the actual asynchronous writes', async () => {
  const lines = [];
  const journal = eventJournal('/fixture', () => assert.fail('Unexpected error'), () => new Writable({ write(chunk, encoding, callback) { setImmediate(() => { lines.push(chunk.toString()); callback(); }); } }));
  const pending = [journal.write({ n: 1 }), journal.write({ n: 2 })];
  await journal.close(); await Promise.all(pending);
  assert.deepEqual(lines.map(JSON.parse), [{ n: 1 }, { n: 2 }]);
});

test('low or unknown disk availability prevents a paid trial before startup', async () => {
  for (const bavail of [0, 1024, NaN]) await assert.rejects(requireDiskSpace('/fixture', async () => ({ bavail, bsize: 4096 })), error => error.code === 'EVAL_DISK_SPACE' && classifyFailure(error, 'preflight') === 'storage');
  assert.equal(await requireDiskSpace('/fixture', async () => ({ bavail: 131072, bsize: 4096 })), 512 * 1024 * 1024);
});
