import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { langfuseApi } from './langfuse-api.mjs';

const [collectorRoot, projectId] = process.argv.slice(2);
assert.ok(collectorRoot && projectId, 'Usage: smoke-openclaw-gisul.mjs <collector checkout> <Langfuse project ID>');
const { createHookCollector } = await import(pathToFileURL(join(resolve(collectorRoot), 'hooks.mjs')));
const configFile = process.env.LANGFUSE_CONFIG ?? join(homedir(), '.codex/langfuse-masked.json');
const api = await langfuseApi(configFile);
assert.deepEqual((await api.request('/api/public/projects')).data.map(p => p.id), [projectId]);
const servers = JSON.parse(execFileSync('openclaw', ['mcp', 'list', '--json'], { encoding: 'utf8', timeout: 30000 }));
assert.ok(servers.gisul, 'Configure the OpenClaw gisul server first');
const runId = `synthetic-gisul-${randomUUID()}`, agentId = 'synthetic-gisul-verification';
const out = resolve('eval/out/openclaw-gisul', runId);
await mkdir(out, { recursive: true, mode: 0o700 });
const client = new Client({ name: 'openclaw-gisul-canary', version: '1' });
const messages = [{ role: 'user', content: 'Synthetic transport/collector check; no model or channel message.' }], calls = [];
let loaded;
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError);
  const value = JSON.parse(result.content[0].text);
  const summary = Object.fromEntries(['uri', 'release', 'commit', 'server_version', 'manifest_digest', 'connection_id', 'movedFrom'].filter(k => value[k] !== undefined).map(k => [k, value[k]]));
  const id = `call-${calls.length}`;
  calls.push({ name, ...summary });
  messages.push({ role: 'assistant', content: [{ type: 'toolCall', id, name: `gisul__${name}`, arguments: args }] }, { role: 'toolResult', toolCallId: id, toolName: `gisul__${name}`, content: [{ type: 'text', text: JSON.stringify({ ...summary, body_omitted: true }) }] });
  return value;
}
try {
  await client.connect(new StdioClientTransport({ ...servers.gisul, stderr: 'pipe' }));
  const found = await call('search_skills', { query: 'dont-make-me-think', limit: 1 });
  loaded = await call('load_skill', { uri: found.skills[0].uri });
  const uri = loaded.files.find(uri => uri !== loaded.uri && uri.endsWith('.md'));
  assert.ok(uri);
  const read = await call('read_skill_file', { skill_uri: loaded.uri, uri });
  assert.equal(read.commit, loaded.commit); assert.equal(read.manifest_digest, loaded.manifest_digest); assert.ok(read.text.length);
} finally { await client.close(); }
messages.push({ role: 'assistant', content: 'Synthetic verification completed.' });
const config = { ...JSON.parse(await readFile(configFile, 'utf8')), test_tag: 'synthetic' };
const collector = createHookCollector({ config, stateDir: join(out, 'queue') });
const event = { success: true, messages, runId, sessionId: runId, durationMs: 0 };
try { collector.observe('agent_end', event, { agentId, runId, sessionId: runId }); await collector.flush(); }
finally { await collector.stop(); }
const trace = createHash('sha256').update(`${agentId}:${runId}`).digest('hex').slice(0, 32);
const object = value => typeof value === 'string' ? JSON.parse(value) : value;
let verified, lastError;
for (let attempt = 0; attempt < 10; attempt++) {
  try {
    const remote = await api.request(`/api/public/traces/${trace}`), metadata = object(remote.metadata);
    assert.ok(remote.tags.includes('synthetic'));
    const gisul = object(metadata.gisul), run = object(metadata.run);
    assert.equal(gisul.loads.length, 1); assert.equal(gisul.loads[0].release, loaded.release);
    assert.equal(gisul.loads[0].commit, loaded.commit); assert.equal(gisul.loads[0].manifest_digest, loaded.manifest_digest);
    assert.equal(object(metadata.quality).gisul_join, 'complete'); assert.equal(run.turn_id, runId);
    verified = true; break;
  } catch (e) { if (e.status && e.status !== 404) throw e; lastError = e; }
  await delay(1500);
}
if (!verified) throw lastError;
const receipt = { checked_at: new Date().toISOString(), synthetic: true, model_run: false, gateway_turn: false, collector_checkout: resolve(collectorRoot), trace_url: `${api.origin}/project/${projectId}/traces/${trace}`, calls, metadata_verified: true };
await writeFile(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify(receipt, null, 2));
