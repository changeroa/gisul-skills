import { appendFile } from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'gisul-codex', version: '0.1.0' });
for (const [name, inputSchema, description] of [
  ['search_skills', { query: z.string().optional(), mode: z.string().optional(), commit: z.string().optional(), limit: z.number().optional(), offset: z.number().optional() }, 'Find remote personal/team workflow skills. Returns names, descriptions and exact URIs, not full content.'],
  ['load_skill', { uri: z.string(), commit: z.string().optional() }, 'Fetch and verify a selected remote SKILL.md. Use its exact URI, not a name.'],
  ['read_skill_file', { skill_uri: z.string(), uri: z.string(), load_id: z.string().optional() }, 'Read a supporting text file using the manifest pinned by load_skill.'],
]) server.registerTool(name, { inputSchema, description, annotations: { readOnlyHint: true } }, async args => {
  if (process.env.EVAL_FAULT_LOG) await appendFile(process.env.EVAL_FAULT_LOG, JSON.stringify({ event: 'error', operation: name === 'search_skills' ? 'search' : name, ...args, code: 'UPSTREAM_UNAVAILABLE' }) + '\n', { mode: 0o600 });
  return { isError: true, content: [{ type: 'text', text: 'Gisul upstream unavailable: connection refused. No remote content was read.' }] };
});
await server.connect(new StdioServerTransport());
