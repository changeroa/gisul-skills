import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectQuality, reportFor, summarizeRoot, windowFor } from "../scripts/langfuse-quality.mjs";

const row = (id, extra={}) => ({ id, traceId: `trace-${id}`, projectId: "test-project", sessionId: "session", startTime: "2020-01-01T00:00:00Z", endTime: "2020-01-01T00:01:00Z", input: '"hello"', output: '"done"', metadata: { run: { turn_index: 1 }, quality: {} }, ...extra });
test("quality distinguishes unknown identities, synthetic traffic, real duplicates and empty days", () => {
  const state = { window: windowFor("2020-01-01", "Asia/Seoul"), rows: {}, repeated_rows: 0, pages: 1, complete: true };
  assert.equal(state.window.from, "2019-12-31T15:00:00.000Z");
  assert.equal(reportFor(state).passed, false);
  state.rows.a = summarizeRoot(row("a")); assert.equal(reportFor(state).passed, true);
  state.rows.synthetic = summarizeRoot(row("s", { tags: ["synthetic"], input: null, output: null }));
  assert.equal(reportFor(state).counts.missing_input, 0);
  state.rows.b = summarizeRoot(row("b")); assert.equal(reportFor(state).counts.duplicate_turn_traces, 1);
  delete state.rows.b;
  state.rows.unknown = summarizeRoot(row("unknown", { metadata: {} }));
  assert.equal(reportFor(state).counts.unknown_turn_identity, 1); assert.equal(reportFor(state).passed, false);
  assert.throws(()=>windowFor("2020-02-31", "UTC"), /Invalid calendar/);
});
test("429 checkpoints the unconsumed cursor and resumes without refetching completed pages", async t => {
  const out = await mkdtemp(join(tmpdir(), "langfuse-quality-")); t.after(()=>rm(out,{recursive:true,force:true}));
  const calls = []; let fail = true;
  const api = { origin: "https://example.invalid", async request(path) {
    if (path.endsWith("projects")) return {data:[{id:"test-project"}]};
    const url = new URL(path, this.origin); const cursor = url.searchParams.get("cursor"); calls.push(cursor);
    if (!cursor) return { data: [row("a")], meta: {cursor:"page-two"} };
    if (fail) { const error = new Error("HTTP 429"); error.status=429; error.retryAfter="60"; throw error; }
    return {data:[row("b",{metadata:{run:{turn_index:2}}})],meta:{}};
  } };
  const options={api,projectId:"test-project",date:"2020-01-01",out};
  await assert.rejects(collectQuality(options), /429/);
  const incomplete=JSON.parse(await readFile(join(out,"2020-01-01-Asia-Seoul.json")));
  assert.equal(incomplete.complete,false); assert.equal(incomplete.error.retry_after,"60");
  fail=false;
  await assert.rejects(collectQuality(options), /resume after/);
  const report=await collectQuality({...options,now:()=>Date.now()+61000});
  assert.deepEqual(calls,[null,"page-two","page-two"]); assert.equal(report.counts.roots,2);assert.equal(report.passed,true);
  await collectQuality(options); assert.equal(calls.length,3);
  const checkpoint=await readFile(join(out,"2020-01-01-Asia-Seoul.checkpoint.json"),"utf8");
  assert.ok(!checkpoint.includes("hello"));assert.ok(!checkpoint.includes("done"));
  await assert.rejects(collectQuality({...options,projectId:"wrong"}), /identity/);
});

test("E-14 audits the whole Codex population without treating an incomplete day or unknown producer as a pass", () => {
  const state={schema_version:2,window:windowFor("2020-01-01","Asia/Seoul"),rows:{},repeated_rows:0,pages:1,complete:true};
  const gate=()=>reportFor(state).gates.e14_codex_duplicate_free;
  assert.equal(gate().passed,false);
  state.rows.codex=summarizeRoot(row("a",{tags:["codex"]}));
  state.rows.openclaw=summarizeRoot(row("o",{tags:["openclaw"],metadata:{run_id:"oc-run"}}));
  assert.equal(gate().passed,true);
  assert.equal(reportFor(state).passed,false); // OpenClaw context remains incomplete.
  assert.equal(reportFor(state,new Date('2019-12-31T16:00:00Z')).gates.e14_codex_duplicate_free.passed,false);
  state.rows.duplicate=summarizeRoot(row("b",{tags:["agent:codex"]}));
  assert.equal(gate().duplicate_turn_traces,1);assert.equal(gate().passed,false);
  delete state.rows.duplicate;
  state.rows.unknown=summarizeRoot(row("u",{tags:[],metadata:{}}));assert.equal(gate().passed,false);
  delete state.rows.unknown;
  delete state.schema_version;assert.equal(gate().passed,false); // Recollect legacy checkpoints with full attribution.
  assert.equal(summarizeRoot(row("ambiguous",{tags:["codex","openclaw"]})).agent,"unknown");
});

test("OpenClaw declared turn identity detects duplicates without trusting legacy random fallback IDs", () => {
  const native = (id, turn_id) => summarizeRoot(row(id, { tags: ['openclaw'], metadata: { run: { agent_kind: 'openclaw', turn_id } } }));
  const state = { schema_version: 2, window: windowFor('2020-01-01', 'UTC'), rows: { a: native('a', 'native-run') }, repeated_rows: 0, pages: 1, complete: true };
  assert.equal(reportFor(state).counts.unknown_turn_identity, 0);
  state.rows.b = native('b', 'native-run');
  assert.equal(reportFor(state).counts.duplicate_turn_traces, 1);
  assert.equal(reportFor(state).passed, false);
  assert.equal(native('no-id', null).turn, null);
  assert.equal(summarizeRoot(row('legacy', { tags: ['openclaw'], metadata: { run_id: 'possibly-random' } })).turn, null);
  assert.equal(summarizeRoot(row('other-producer', { tags: ['codex'], metadata: { run: { agent_kind: 'openclaw', turn_id: 'native-run' } } })).turn, null);
});
