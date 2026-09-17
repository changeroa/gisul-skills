import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { langfuseApi } from "./langfuse-api.mjs";

// Real installed-plugin calls; only their metadata enters an explicitly synthetic
// exporter fixture. This is not a model-selection eval or a production user turn.
const [expectedCommit, expectedServer, project] = process.argv.slice(2);
assert.match(expectedCommit ?? "", /^[a-f0-9]{40}$/, "Usage: node scripts/smoke-installed-worker.mjs <content commit> <runtime commit> <Langfuse project ID>");
assert.match(expectedServer ?? "", /^[a-f0-9]{40}$/);
assert.ok(project, "Select the expected Langfuse project explicitly");
const installed = JSON.parse(execFileSync("codex", ["plugin", "list", "--marketplace", "personal", "--json"], { encoding: "utf8" })).installed;
const codexRoot = process.env.CODEX_HOME ?? join(homedir(), ".codex");
function plugin(name) {
  const entries = installed.filter(item => item.pluginId === `${name}@personal` && item.enabled);
  assert.equal(entries.length, 1, `Expected one enabled ${name} plugin`);
  const item = entries[0];
  assert.equal(item.source.source, "local");
  return { ...item, cache: join(codexRoot, "plugins/cache/personal", name, item.version) };
}
const bridge = plugin("gisul"), exporter = plugin("langfuse-masked");
for (const file of [".codex-plugin/plugin.json", ".mcp.json", "runtime/codex.mjs", "skills/gisul/SKILL.md"]) {
  assert.deepEqual(await readFile(join(bridge.cache, file)), await readFile(join(bridge.source.path, file)), `Installed ${file} differs from source`);
}
const config = JSON.parse(await readFile(join(bridge.cache, ".mcp.json"))).mcpServers.gisul;
const endpoint = config.args[config.args.indexOf("--http-url") + 1];
assert.ok(config.args.includes("--http-url") && endpoint.startsWith("https://"), "Expected the installed HTTPS plugin");
const api = await langfuseApi();
const projects = await api.request("/api/public/projects");
assert.deepEqual(projects.data.map(item => item.id), [project], "Langfuse credential target differs from the selected project");
const session = `synthetic-worker-canary-${randomUUID()}`;
const out = resolve("eval/out/worker-canary", session);
await mkdir(out, { recursive: true, mode: 0o700 });
const events = join(out, "events"), rollout = join(out, "synthetic-rollout.jsonl");
const lines = [], calls = [];
const record = (type, payload) => lines.push({ timestamp: new Date().toISOString(), type, payload });
record("session_meta", { id: session, cwd: process.cwd(), source: "synthetic-installed-plugin-check" });
record("event_msg", { type: "task_started", turn_id: "canary" });
record("event_msg", { type: "user_message", message: "Synthetic integration check: search, load and read the installed gisul HTTPS plugin. No model run or production user turn." });
const client = new Client({ name: "gisul-installed-worker-canary", version: "1" });
let loaded, support;
async function call(tool, args) {
  const started = Date.now();
  const result = await client.callTool({ name: tool, arguments: args });
  assert.ok(!result.isError, JSON.stringify(result.content));
  const data = JSON.parse(result.content[0].text);
  assert.equal(data.commit, expectedCommit);
  assert.match(data.release ?? "", /^\d{8}\.\d+$/);
  if (loaded) assert.equal(data.release, loaded.release);
  assert.ok(data.connection_id);
  const summary = Object.fromEntries(["origin", "release", "commit", "server_version", "uri", "manifest_digest", "connection_id", "totalMatches"].filter(key => data[key] !== undefined).map(key => [key, data[key]]));
  calls.push({ tool, arguments: args, ...summary });
  const duration = Date.now() - started;
  record("event_msg", { type: "item_completed", item: { type: "McpToolCall", id: `call-${calls.length}`, server: "gisul", tool, arguments: args, result: { content: [{ type: "text", text: JSON.stringify({ ...summary, body_omitted: true }) }] }, status: "completed", duration: { secs: Math.floor(duration / 1000), nanos: (duration % 1000) * 1e6 } } });
  return data;
}
try {
  await client.connect(new StdioClientTransport({ ...config, cwd: bridge.cache, env: { ...config.env, GISUL_EVENT_LOG_DIR: events }, stderr: "pipe" }));
  assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), ["load_skill", "read_skill_file", "search_skills"]);
  const found = await call("search_skills", { query: "dont-make-me-think", limit: 1 });
  assert.equal(found.skills.length, 1);
  loaded = await call("load_skill", { uri: found.skills[0].uri });
  assert.equal(loaded.release, found.release);
  assert.match(loaded.manifest_digest ?? "", /^sha256:[a-f0-9]{64}$/);
  assert.equal(loaded.server_version, expectedServer);
  const body = await call("read_skill_file", { skill_uri: loaded.uri, uri: loaded.uri });
  assert.equal(body.text, loaded.markdown);
  support = loaded.files.find(uri => uri !== loaded.uri && uri.endsWith(".md"));
  if (!support) {
    const directory = loaded.files.find(uri => uri !== loaded.uri && !uri.endsWith(".md"));
    assert.ok(directory, "Expected a supporting file or directory");
    const listing = await call("read_skill_file", { skill_uri: loaded.uri, uri: directory });
    support = listing.files.find(uri => uri.endsWith(".md"));
  }
  assert.ok(support, "Expected supporting Markdown");
  assert.ok((await call("read_skill_file", { skill_uri: loaded.uri, uri: support })).text.length);
} finally { await client.close(); }
record("response_item", { type: "message", role: "assistant", content: [{ type: "output_text", text: "Synthetic integration check passed: installed HTTPS search, load and supporting-file reads verified." }] });
record("event_msg", { type: "task_complete", turn_id: "canary" });
await writeFile(rollout, lines.map(line => JSON.stringify(line)).join("\n") + "\n", { mode: 0o600 });
const trace = createHash("sha256").update(`${session}:1`).digest("hex").slice(0, 32);
const receipt = { synthetic: true, model_run: false, session, trace_id: trace, trace_url: `${api.origin}/project/${project}/traces/${trace}`, endpoint, content_commit: expectedCommit, runtime_commit: expectedServer, release: loaded.release, manifest_digest: loaded.manifest_digest, plugin_version: bridge.version, exporter_version: exporter.version, calls };
await writeFile(join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
const hook = join(exporter.cache, "plugins/tracing/dist/index.mjs");
assert.deepEqual(await readFile(hook), await readFile(join(exporter.source.path, "plugins/tracing/dist/index.mjs")));
const env = { ...process.env, TRACE_TO_LANGFUSE: "true", LANGFUSE_CODEX_SYNTHETIC: "true", LANGFUSE_CODEX_AGENT_KIND: "codex", LANGFUSE_CODEX_TRACE_SEED: session, LANGFUSE_CODEX_TAGS: '["synthetic","worker-r2-canary"]', LANGFUSE_CODEX_FAIL_ON_ERROR: "true", LANGFUSE_CODEX_STATE_FILE: join(out, "state.json"), LANGFUSE_CODEX_EXPORT_JOURNAL: join(out, "exports"), GISUL_EVENT_LOG_DIR: events };
function exportFixture() {
  const result = spawnSync(process.execPath, [hook], { cwd: process.cwd(), env, input: JSON.stringify({ session_id: session, turn_id: "canary", transcript_path: rollout }), encoding: "utf8", timeout: 60000 });
  assert.equal(result.status, 0, `Installed exporter failed: ${result.stderr}`);
}
const object = value => typeof value === "string" ? JSON.parse(value) : value ?? {};
function context(value) {
  const metadata = object(value?.metadata);
  return { quality: object(metadata.quality), gisul: object(metadata.gisul) };
}
function validateRemote(remote) {
  const metadata = context(remote);
  assert.equal(metadata.quality.synthetic, true);
  assert.equal(metadata.quality.gisul_join, "complete");
  assert.ok(metadata.gisul.loads.some(load => load.commit === expectedCommit && load.release === loaded.release && load.manifest_digest === loaded.manifest_digest));
  const observations = remote.observations ?? [];
  assert.equal(observations.length, calls.length + 2, "Expected one root, one step and each actual tool call");
  assert.equal(new Set(observations.map(item => item.id)).size, observations.length, "Repeated observation IDs");
  const tools = observations.filter(item => item.type === "TOOL");
  assert.deepEqual(tools.map(item => item.name).sort(), calls.map(call => `gisul.${call.tool}`).sort());
  assert.deepEqual(tools.map(item => object(item.metadata)["codex.call_id"]).sort(), calls.map((_, i) => `call-${i + 1}`).sort());
  return observations.map(item => item.id).sort();
}
async function readback() {
  let failure;
  for (let attempt = 0; attempt < 10; attempt++) {
    try { return validateRemote(await api.request(`/api/public/traces/${trace}`)); }
    catch (error) { if (error.status && error.status !== 404) throw error; failure = error; }
    await delay(2000);
  }
  throw failure;
}
exportFixture();
const firstIds = await readback();
// Reinvoke the installed hook for this new fixture only; compare actual API rows.
exportFixture();
await delay(2000);
const repeatedIds = await readback();
assert.deepEqual(repeatedIds, firstIds, "Repeat hook changed observation identities or multiplicity");
Object.assign(receipt, { langfuse_verified: true, observations: firstIds.length, observation_ids: firstIds, repeated_hook_readback_unchanged: true, output_directory: out });
await writeFile(join(out, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
console.log(JSON.stringify(receipt, null, 2));
