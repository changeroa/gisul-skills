import test from 'node:test';
import assert from 'node:assert/strict';
import { selectInstalledLoader, isolatedConfig } from './environment.mjs';

test('historical discovery adapter prefers enabled Skillar and retains legacy installation support', () => {
  const current = { name: 'skillar:skillar', enabled: true };
  const legacy = { name: 'gisul:gisul', enabled: true };
  assert.equal(selectInstalledLoader([legacy, current]), current);
  assert.equal(selectInstalledLoader([legacy, { ...current, enabled: false }]), legacy);
  assert.throws(() => selectInstalledLoader([current, current]), /Ambiguous/);
  assert.throws(() => selectInstalledLoader([]), /not found/);
  const config = isolatedConfig({ model: 'fixture', effort: 'high', skills: [], pluginIds: [], mcpNames: ['skillar'], mcp: { env: { FIXTURE: 'preserved' } } }, '/synthetic/events');
  assert.equal(config['mcp_servers.skillar.enabled'], false);
  assert.deepEqual(config['mcp_servers.gisul'].env, { FIXTURE: 'preserved', SKILLAR_EVENT_LOG_DIR: '/synthetic/events', GISUL_EVENT_LOG_DIR: '/synthetic/events' });
});
