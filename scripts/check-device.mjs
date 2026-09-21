import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const devices = ['macbook-pro', 'macmini', 'macbook-air'];
const pluginNames = ['gisul', 'langfuse-masked'];

export function compareDevices(snapshots, { now = Date.now(), maxAgeMs = 86400000 } = {}) {
  const failures = [], byName = new Map();
  for (const snapshot of snapshots) {
    const name = snapshot?.device;
    if (!devices.includes(name) || byName.has(name)) {
      failures.push(`Unknown or duplicate device: ${name}`); continue;
    }
    byName.set(name, snapshot);
    const age = now - Date.parse(snapshot.checked_at);
    if (!Number.isFinite(age) || age < -60000 || age > maxAgeMs) failures.push(`${name}: stale or invalid timestamp`);
    if (snapshot.schema_version !== 1 || snapshot.complete !== true || snapshot.errors?.length) failures.push(`${name}: incomplete snapshot`);
    if (!/^sha256:[a-f0-9]{64}$/.test(snapshot.agents?.digest ?? '')) failures.push(`${name}: missing AGENTS digest`);
    for (const plugin of pluginNames) if (!snapshot.plugins?.[plugin]?.enabled || !snapshot.plugins[plugin].version) failures.push(`${name}: missing enabled ${plugin}`);
    if (!snapshot.gisul?.release || !/^[a-f0-9]{40}$/.test(snapshot.gisul?.commit ?? '') || !/^sha256:[a-f0-9]{64}$/.test(snapshot.gisul?.manifest_digest ?? '')) failures.push(`${name}: unverified live release`);
    try {
      const endpoint = new URL(snapshot.gisul?.endpoint);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search) throw new Error();
    } catch { failures.push(`${name}: missing or invalid HTTPS endpoint`); }
  }
  for (const name of devices) if (!byName.has(name)) failures.push(`${name}: missing snapshot`);
  const fields = {
    'AGENTS.md': s => s.agents?.digest,
    ...Object.fromEntries(pluginNames.map(name => [`plugin ${name}`, s => s.plugins?.[name]?.version])),
    'gisul release': s => s.gisul?.release,
    'gisul commit': s => s.gisul?.commit,
    'gisul manifest': s => s.gisul?.manifest_digest,
    'gisul endpoint': s => s.gisul?.endpoint,
  };
  for (const [field, get] of Object.entries(fields)) {
    if (new Set([...byName.values()].map(get)).size > 1) failures.push(`${field}: differs between devices`);
  }
  return { checked_at: new Date(now).toISOString(), passed: failures.length === 0, devices: [...byName.keys()], failures };
}

export async function snapshotDevice(device, codexRoot = process.env.CODEX_HOME ?? join(homedir(), '.codex')) {
  if (!devices.includes(device)) throw new Error(`Choose --device ${devices.join('|')}`);
  const result = { schema_version: 1, device, checked_at: new Date().toISOString(), complete: false, plugins: {}, errors: [] };
  try {
    const agents = await readFile(join(codexRoot, 'AGENTS.md'));
    result.agents = { bytes: agents.length, digest: `sha256:${createHash('sha256').update(agents).digest('hex')}` };
  } catch { result.errors.push('Cannot read global AGENTS.md'); }
  let installed;
  try {
    result.codex_version = execFileSync('codex', ['--version'], { encoding: 'utf8', timeout: 15000 }).trim();
    installed = JSON.parse(execFileSync('codex', ['plugin', 'list', '--json'], { encoding: 'utf8', timeout: 30000, env: { ...process.env, CODEX_HOME: codexRoot } })).installed;
    for (const name of pluginNames) {
      const matches = installed.filter(p => p.pluginId === `${name}@personal` && p.enabled);
      if (matches.length !== 1) throw new Error('Missing or ambiguous plugin');
      result.plugins[name] = { version: matches[0].version, enabled: true };
    }
  } catch { result.errors.push('Cannot verify one enabled gisul and langfuse-masked plugin'); }
  if (result.plugins.gisul) {
    const client = new Client({ name: 'gisul-device-check', version: '1' });
    try {
      const cache = join(codexRoot, 'plugins/cache/personal/gisul', result.plugins.gisul.version);
      const config = JSON.parse(await readFile(join(cache, '.mcp.json'), 'utf8')).mcpServers.gisul;
      const httpIndex = config.args.indexOf('--http-url');
      if (httpIndex < 0) throw new Error('Expected the current Worker HTTPS path');
      const endpoint = new URL(config.args[httpIndex + 1]);
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search) throw new Error('Invalid HTTPS endpoint');
      await client.connect(new StdioClientTransport({ ...config, cwd: cache, stderr: 'pipe' }));
      const call = async (name, args) => {
        const response = await client.callTool({ name, arguments: args }, undefined, { timeout: 30000 });
        if (response.isError) throw new Error('MCP verification failed');
        return JSON.parse(response.content[0].text);
      };
      const found = await call('search_skills', { limit: 1 });
      const loaded = await call('load_skill', { uri: found.skills[0].uri });
      const body = await call('read_skill_file', { skill_uri: loaded.uri, uri: loaded.uri });
      if (body.text !== loaded.markdown || body.commit !== loaded.commit) throw new Error('MCP read differs from selected manifest');
      if (!loaded.release || !/^[a-f0-9]{40}$/.test(loaded.commit ?? '') || !/^sha256:[a-f0-9]{64}$/.test(loaded.manifest_digest ?? '')) throw new Error('Live release metadata is incomplete');
      result.gisul = { endpoint: endpoint.href, release: loaded.release, commit: loaded.commit, manifest_digest: loaded.manifest_digest };
    } catch { result.errors.push('Installed HTTPS plugin could not verify a live skill and file'); }
    finally { await client.close(); }
  }
  result.complete = result.errors.length === 0;
  return result;
}

async function main(args) {
  if (args[0] === '--device' && args[2] === '--out' && args.length === 4) {
    const result = await snapshotDevice(args[1]);
    const target = resolve(args[3]);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.complete ? 0 : 2;
  } else if (args[0] === '--compare' && args.length > 1) {
    const snapshots = await Promise.all(args.slice(1).map(async path => JSON.parse(await readFile(path, 'utf8'))));
    const result = compareDevices(snapshots);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 2;
  } else throw new Error('Usage: check-device.sh --device DEVICE --out FILE | --compare SNAPSHOT...');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
