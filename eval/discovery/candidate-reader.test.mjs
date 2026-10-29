import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { materializeCandidate } from '../materialize-candidate.mjs';

test('historical candidate adapter reads current canonical URIs with only the current event variable', { timeout: 30000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'skillar-discovery-adapter-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = join(root, 'content'), eventDir = join(root, 'events');
  const candidate = await materializeCandidate(content);
  const server = process.env.SKILLAR_SERVER_PATH ?? fileURLToPath(new URL('../../../skillar/server/dist/index.js', import.meta.url));
  const env = { ...process.env, SKILLAR_EVENT_LOG_DIR: eventDir };
  delete env.GISUL_EVENT_LOG_DIR;
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./candidate-reader.mjs', import.meta.url)), '--bundle=' + join(dirname(server), 'codex.js'), '--server=' + server, '--content=' + content], env, stderr: 'pipe' });
  let stderr = '';
  transport.stderr.on('data', bytes => { stderr += bytes; });
  const client = new Client({ name: 'discovery-adapter-contract', version: '1' });
  try {
    await client.connect(transport);
    const searched = await client.callTool({ name: 'search_skills', arguments: { query: '기획', mode: 'discovery' } });
    assert.ok(!searched.isError, stderr);
    const body = JSON.parse(searched.content[0].text);
    assert.equal(body.release, candidate.release);
    const uri = body.skills[0].uri;
    assert.match(uri, /^skill:\/\/skillar\/iyen\//);
    const loaded = await client.callTool({ name: 'load_skill', arguments: { uri } });
    assert.ok(!loaded.isError, stderr);
    assert.equal(JSON.parse(loaded.content[0].text).uri, uri);
  } finally { await client.close(); }
  const events = (await Promise.all((await readdir(eventDir)).filter(name => name.endsWith('.jsonl')).map(name => readFile(join(eventDir, name), 'utf8')))).join('\n');
  assert.match(events, /load_skill/);
});
