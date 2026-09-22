import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// The installed, digest-pinned bridge still owns search, manifests and content
// verification. This adapter only freezes its upstream and removes write tools.
export function pinClient(client, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Invalid content commit');
  return new Proxy(client, { get(target, key) {
    if (key === 'request') return async (request, ...rest) => {
      if (!['skills/list', 'skills/get', 'resources/read'].includes(request.method)) throw new Error('Evaluation upstream is read-only');
      const requested = request.params?._meta?.['io.gisul/commit'];
      if (requested && requested !== commit) throw new Error('Content pin mismatch');
      const response = await target.request({ ...request, params: { ...request.params, _meta: { ...request.params?._meta, 'io.gisul/commit': commit } } }, ...rest);
      if (response._meta?.commit !== commit) throw new Error('Pinned release unavailable');
      return response;
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
}

async function main() {
  if (process.env.EVAL_GISUL_OFFLINE === '1') {
    const server = new McpServer({ name: 'gisul-unavailable', version: '1' });
    for (const [name, inputSchema] of Object.entries({ search_skills: { query: z.string().optional(), limit: z.number().optional(), offset: z.number().optional() }, load_skill: { uri: z.string() }, read_skill_file: { skill_uri: z.string(), uri: z.string() } })) {
      server.registerTool(name, { description: 'Read remote skills.', inputSchema }, async () => ({ isError: true, content: [{ type: 'text', text: 'Not connected' }] }));
    }
    await server.connect(new StdioServerTransport());
    return;
  }
  const config = JSON.parse(await readFile(process.env.EVAL_READER_CONFIG, 'utf8'));
  const bytes = await readFile(config.bundle);
  if (createHash('sha256').update(bytes).digest('hex') !== config.bundleHash) throw new Error('Installed reader changed since freeze');
  const endpoint = new URL(config.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Credential-free HTTPS required');
  const token = (await readFile(config.tokenFile, 'utf8')).trim();
  if (!token || /\s/.test(token)) throw new Error('Invalid bearer file');
  const { createCodexBridge, createGisulEventLog } = await import(pathToFileURL(config.bundle).href);
  const client = new Client({ name: 'gisul-formal-eval', version: '1' });
  const transport = new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { Authorization: `Bearer ${token}` }, redirect: 'error' } });
  await client.connect(transport);
  const events = createGisulEventLog(endpoint.origin, process.env.GISUL_EVENT_LOG_DIR);
  const server = createCodexBridge(pinClient(client, config.commit), endpoint.origin, events, true);
  await server.connect(new StdioServerTransport());
  let closing = false;
  const close = async () => { if (closing) return; closing = true; await server.close(); await client.close(); await events.flush(); };
  process.stdin.on('end', () => void close());
  process.on('SIGTERM', () => void close());
  process.on('SIGINT', () => void close());
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(String(error)); process.exitCode = 1; });
