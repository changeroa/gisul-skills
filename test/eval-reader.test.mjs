import test from 'node:test';
import assert from 'node:assert/strict';
import { pinClient } from '../eval/reader.mjs';
const commit = 'a'.repeat(40);
test('all reads pin upstream; unavailable content cannot substitute current', async () => {
  const requests = [];
  const client = pinClient({ request: async request => { requests.push(request); return { _meta: { commit } }; } }, commit);
  for (const method of ['skills/list', 'skills/get', 'resources/read']) await client.request({ method, params: { uri: 'skill://gisul/gisul/test/SKILL.md' } });
  assert.ok(requests.every(request => request.params._meta['io.gisul/commit'] === commit));
  await assert.rejects(client.request({ method: 'tools/call' }), /read-only/);
  await assert.rejects(client.request({ method: 'skills/get', params: { _meta: { 'io.gisul/commit': 'b'.repeat(40) } } }), /pin mismatch/);
  await assert.rejects(pinClient({ request: async () => ({ _meta: { commit: 'b'.repeat(40) } }) }, commit).request({ method: 'skills/list' }), /unavailable/);
});
