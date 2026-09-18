import test from 'node:test';
import assert from 'node:assert/strict';
import { compareDevices, devices } from '../scripts/check-device.mjs';

const now = Date.parse('2026-09-18T08:00:00Z');
const snapshots = () => devices.map(device => ({ schema_version: 1, device, complete: true, checked_at: new Date(now).toISOString(), errors: [], agents: { digest: `sha256:${'a'.repeat(64)}` }, plugins: { gisul: { enabled: true, version: '1' }, 'langfuse-masked': { enabled: true, version: '2' } }, gisul: { endpoint: 'https://example.test/mcp', release: 'test.1', commit: 'b'.repeat(40), manifest_digest: `sha256:${'c'.repeat(64)}` } }));

test('device comparison requires three fresh, complete, independently named snapshots', () => {
  assert.equal(compareDevices(snapshots(), { now }).passed, true);
  assert.equal(compareDevices(snapshots().slice(0, 1), { now }).passed, false);
  const duplicate = snapshots(); duplicate[2].device = 'macmini';
  assert.equal(compareDevices(duplicate, { now }).passed, false);
  assert.equal(compareDevices(snapshots(), { now: now + 86400001 }).passed, false);
  const withoutEndpoints = snapshots(); withoutEndpoints.forEach(s => { delete s.gisul.endpoint; });
  assert.equal(compareDevices(withoutEndpoints, { now }).passed, false);
});

test('matching release labels cannot hide different content, instructions or missing plugins', () => {
  for (const mutate of [
    s => { s.gisul.commit = 'd'.repeat(40); },
    s => { s.agents.digest = `sha256:${'e'.repeat(64)}`; },
    s => { delete s.plugins.gisul; },
    s => { s.complete = false; },
    s => { s.gisul.manifest_digest = null; },
  ]) {
    const items = snapshots(); mutate(items[1]);
    assert.equal(compareDevices(items, { now }).passed, false);
  }
});
