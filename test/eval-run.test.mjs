import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCost, stopReason, classifyFailure } from '../eval/run.mjs';
test('cost separates cached and cache-write tokens; reasoning is already in output', () => {
  const usage = { inputTokens: 1000000, cachedInputTokens: 400000, cacheWriteInputTokens: 100000, outputTokens: 100000, reasoningOutputTokens: 50000 };
  assert.equal(estimateCost(usage),11.65);
  assert.equal(estimateCost(usage,true),15);
  assert.equal(estimateCost({...usage,cachedInputTokens:1000001}),null);
  assert.equal(estimateCost(null),null);
});
test('stop rules preserve infra, isolation and budget failures rather than retrying', () => {
  assert.equal(stopReason([{failure:{type:'isolation'}}],10),'isolation_failure');
  assert.equal(stopReason([{failure:{type:'infrastructure'}},{failure:{type:'infrastructure'}}],10),'two_infrastructure_failures');
  assert.equal(stopReason([{status:'completed',usage:null}],10),'missing_usage');
  assert.equal(stopReason([{usage:{totalTokens:11}}],10),'observed_token_limit');
  assert.equal(stopReason([{status:'failed',failure:{type:'execution'},usage:{totalTokens:1}}],10),null);
});
test('startup failures stop immediately even when their wording lacks isolation', () => {
  for (const message of ['Effective configuration differs: permissions.eval','Enabled skill catalog must contain only the workspace gisul loader','Thread startup did not preserve the pinned model','MCP startup failed']) {
    const failure = {type:classifyFailure(new Error(message),'preflight')};
    assert.equal(stopReason([{failure}],100),'isolation_failure');
  }
  assert.equal(classifyFailure(new Error('Observed content drift'),'evidence'),'isolation');
  assert.equal(classifyFailure(new Error('Model turn exceeded 240000 ms'),'execution'),'execution');
});
