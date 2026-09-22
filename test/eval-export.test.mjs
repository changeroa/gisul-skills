import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { experimentSpan, exportRun } from '../eval/export.mjs';

const protocol = { id: 'frozen-run', hash: 'frozen-protocol', dataset: { version: 'dataset-hash' }, model: 'fixed-model', effort: 'max', profile: 'baseline', reader: { release: '20260922.26', commit: 'a'.repeat(40), bundleHash: 'reader-hash' }, prices: { kind: 'standard_api_equivalent_not_account_bill' } };
const item = { id: 'F-01', input: { prompt: 'Read the API contract' }, expected: { must_read: ['api.js'] }, split: 'development', critical: true };
const result = { threadId: 'native-thread', turnId: 'native-turn', gisulEvents: [{ event: 'load_skill', commit: 'a'.repeat(40), manifest_digest: 'digest' }], startedAt: '2026-09-22T01:00:00.000Z', endedAt: '2026-09-22T01:01:00.000Z', status: 'completed', finalText: 'actual output', files: {}, grading: { status: 'unverified' }, usage: { totalTokens: 10 }, estimatedCost: 0.01 };
test('export identity survives retries and binds actual output, dataset item, synthetic scope and release', () => {
  const span = experimentSpan(protocol,item,result,'dataset-id');
  assert.equal(span.traceId.length,32); assert.equal(span.spanId.length,16);
  assert.deepEqual(experimentSpan(protocol,item,result,'dataset-id'),span);
  const attributes = Object.fromEntries(span.attributes.map(x => [x.key,x.value]));
  assert.equal(attributes['langfuse.experiment.item.root_observation_id'].stringValue,span.spanId);
  assert.equal(attributes['langfuse.experiment.item.id'].stringValue,'agent-env-v1:F-01');
  assert.equal(attributes['langfuse.environment'].stringValue,'evaluation');
  assert.ok(attributes['langfuse.trace.tags'].arrayValue.values.some(x => x.stringValue === 'synthetic'));
  assert.equal(JSON.parse(attributes['langfuse.observation.output'].stringValue).finalText,'actual output');
  assert.equal(JSON.parse(attributes['langfuse.observation.metadata'].stringValue).gisul.commit,'a'.repeat(40));
  assert.notEqual(experimentSpan({...protocol,id:'another-run'},item,result,'dataset-id').traceId,span.traceId);
  assert.notEqual(experimentSpan(protocol,{...item,id:'F-02'},result,'dataset-id').traceId,span.traceId);
});
test('no-model preflight cannot be uploaded as an experiment', async () => {
  const root = await mkdtemp(join(tmpdir(),'eval-export-test-'));
  try {
    await writeFile(join(root,'protocol.json'),JSON.stringify({preflight:true}));
    await assert.rejects(exportRun(root,'project',{apply:true,api:{request:()=>assert.fail('must not call remote')}}),/not a model experiment/);
  } finally { await rm(root,{recursive:true,force:true}); }
});
