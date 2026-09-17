import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { validate } from "./validate.mjs";
const host = process.argv[2] ?? "macmini";
if (!/^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(host)) throw new Error("Invalid SSH host");
const client = new Client({ name: "gisul-source-parity", version: "1" });
const transport = new StdioClientTransport({ command: "ssh", args: ["-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, "gisul"], stderr: "pipe" });
let stderr = ""; transport.stderr.on("data", chunk => stderr += chunk);
try {
  await client.connect(transport);
  const remote = await client.request({ method: "skills/list", params: {} }, z.object({ skills: z.array(z.object({ uri: z.string(), resources: z.array(z.object({ uri: z.string(), digest: z.string(), size: z.number() })) })), _meta: z.unknown().optional() }));
  const local = await validate();
  assert.equal(local.invalid.length, 0);
  const normalize = entries => entries.map(entry => ({ uri: entry.uri.replace("/codex/", "/gisul/"), resources: entry.resources.map(file => ({ ...file, uri: file.uri.replace("/codex/", "/gisul/") })).sort((a,b) => a.uri.localeCompare(b.uri)) })).sort((a,b) => a.uri.localeCompare(b.uri));
  assert.deepEqual(normalize(remote.skills), normalize(local.valid), "Live source changed after import; reconcile before promotion");
  assert.ok(!stderr.includes("Skipping skill"));
  console.log(JSON.stringify({ checked_at: new Date().toISOString(), host, skills: remote.skills.length, parity: true, skipping: 0, metadata: remote._meta ?? null }));
} finally { await client.close(); }
