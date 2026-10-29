import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Evaluation-only adapter: the actual bundled bridge and actual gisul server,
// with exactly three reader tools over an immutable local release fixture.
const options = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const content = resolve(options.content);
const { createCodexBridge, createGisulEventLog } = await import(pathToFileURL(resolve(options.bundle)).href);
const events = createGisulEventLog('candidate-release');
const upstream = new Client({ name: 'gisul-candidate', version: '1' });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(options.server)],
  env: { ...process.env, GISUL_ROOT: content, GISUL_SKILL_ROOTS: 'gisul=' + join(content, 'skills'),
    GISUL_RELEASE_FILE: join(content, 'release.json'), GISUL_ALIASES_FILE: join(content, 'aliases.json'),
    GISUL_STATE_DIR: join(process.env.GISUL_EVENT_LOG_DIR, 'unused-state') }, stderr: 'pipe' });
transport.stderr.on('data', bytes => process.stderr.write(bytes));
await upstream.connect(transport);
const bridge = createCodexBridge(upstream, 'candidate-release', events, true);
await bridge.connect(new StdioServerTransport());
events.emit({ event: 'connect', transport: 'candidate-stdio', synthetic: true });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  events.emit({ event: 'disconnect', reason: 'shutdown', synthetic: true });
  await bridge.close(); await upstream.close(); await events.flush();
}
process.stdin.on('end', () => void close());
process.on('SIGTERM', () => void close());
process.on('SIGINT', () => void close());
