import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProvenance, failureType, stopCondition } from './evidence.mjs';
const commit = 'a'.repeat(40);
const body = { commit, release: 'test.1', connection_id: 'c1', manifest_digest: 'sha256:x' };
const call = value => ({ type: 'mcpToolCall', server: 'gisul', tool: 'load_skill', status: 'completed', arguments: { uri: 'skill://x' }, result: { content: [{ type: 'text', text: JSON.stringify(value) }] } });
const event = { ...body, event: 'load_skill', uri: 'skill://x' };
test('successful calls require independent matching release and digest evidence', () => {
  assert.equal(validateProvenance([{ items: [call(body)] }], [event], commit).verifiedCalls, 1);
  assert.throws(() => validateProvenance([{ items: [call(body)] }], [], commit), /no matching/);
  assert.throws(() => validateProvenance([{ items: [call({ release: 'test.1' })] }], [], commit), /Missing release/);
  assert.throws(() => validateProvenance([{ items: [call(body)] }], [{ ...event, manifest_digest: 'other' }], commit), /differs/);
  assert.throws(() => validateProvenance([{ items: [call(body)] }], [event], 'b'.repeat(40)), /changed/);
});
test('absence of a remote call is valid but unaccounted calls and extra events are not', () => {
  assert.equal(validateProvenance([{ items: [] }], [], commit).verifiedCalls, 0);
  assert.throws(() => validateProvenance([{ items: [] }], [event], commit), /Unattributed/);
  assert.throws(() => validateProvenance([{ items: [call(body), call(body)] }], [event], commit), /no matching/);
});
test('one isolation violation stops a phase; infrastructure errors count separately', () => {
  assert.equal(failureType(new Error('Unexpected external capability: other')), 'isolation_violation');
  assert.equal(stopCondition([{ failure: { type: 'isolation_violation' } }], 100), 'isolation_violation');
  assert.equal(stopCondition([{ failure: { type: 'infrastructure' } }], 100), null);
  assert.equal(stopCondition([{ failure: { type: 'infrastructure' } }, { failure: { type: 'infrastructure' } }], 100), 'two_infrastructure_failures');
});
