import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CHECKPOINT_SCHEMA, collectQuality, reportFor, summarizeRoot, windowFor } from "../scripts/langfuse-quality.mjs";

const row = (id, extra={}) => ({ id, traceId: `trace-${id}`, projectId: "test-project", name: "Codex Turn", type: "AGENT", tags: ["agent:codex"], sessionId: "session", startTime: "2020-01-01T00:00:00Z", endTime: "2020-01-01T00:01:00Z", input: '"hello"', output: '"done"', metadata: { run: { turn_index: 1 }, quality: {} }, ...extra });
const stateFor = (rows = [], extra = {}) => ({ schema_version: CHECKPOINT_SCHEMA, window: windowFor("2020-01-01", "Asia/Seoul"), rows: Object.fromEntries(rows.map(r => [`${r.traceId}/${r.id}`, summarizeRoot(r)])), repeated_rows: 0, pages: 1, complete: true, ...extra });

test("quality distinguishes unknown identities, synthetic traffic, real duplicates and empty days", () => {
  const state = stateFor();
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
  const markdown=await readFile(join(out,"2020-01-01-Asia-Seoul.md"),"utf8");
  assert.ok(markdown.includes("| codex | 2 | 0 | 0 | 0 | 2 |"));
  assert.ok(markdown.includes("| checkpoint_schema | 3 |"));
  await assert.rejects(collectQuality({...options,projectId:"wrong"}), /identity/);
});

test("E-14 audits the whole Codex population without treating an incomplete day or unknown producer as a pass", () => {
  const state=stateFor();
  const gate=()=>reportFor(state).gates.e14_codex_duplicate_free;
  assert.equal(gate().passed,false);
  state.rows.codex=summarizeRoot(row("a",{tags:["codex"]}));
  state.rows.openclaw=summarizeRoot(row("o",{name:"OpenClaw turn",tags:["openclaw"],metadata:{run_id:"oc-run"}}));
  assert.equal(gate().passed,true);
  assert.equal(reportFor(state).passed,false); // OpenClaw context remains incomplete.
  assert.equal(reportFor(state,new Date('2019-12-31T16:00:00Z')).gates.e14_codex_duplicate_free.passed,false);
  state.rows.duplicate=summarizeRoot(row("b",{tags:["agent:codex"]}));
  assert.equal(gate().duplicate_turn_traces,1);assert.equal(gate().passed,false);
  delete state.rows.duplicate;
  state.rows.unknown=summarizeRoot(row("u",{tags:[],metadata:{}}));assert.equal(gate().passed,false);
  delete state.rows.unknown;
  delete state.schema_version;assert.throws(gate, /role schema 3/); // Never promote old checkpoints into new proof.
  assert.equal(summarizeRoot(row("ambiguous",{tags:["codex","openclaw"]})).agent,"unknown");
});

test("OpenClaw declared turn identity detects duplicates without trusting legacy random fallback IDs", () => {
  const native = (id, turn_id) => summarizeRoot(row(id, { name: 'OpenClaw turn', tags: ['openclaw'], metadata: { run: { agent_kind: 'openclaw', turn_id } } }));
  const state = stateFor([], { rows: { a: native('a', 'native-run') } });
  assert.equal(reportFor(state).counts.unknown_turn_identity, 0);
  state.rows.b = native('b', 'native-run');
  assert.equal(reportFor(state).counts.duplicate_turn_traces, 1);
  assert.equal(reportFor(state).passed, false);
  assert.equal(native('no-id', null).turn, null);
  assert.equal(summarizeRoot(row('legacy', { name: 'OpenClaw turn', tags: ['openclaw'], metadata: { run_id: 'possibly-random' } })).turn, null);
  assert.equal(summarizeRoot(row('other-producer', { tags: ['codex'], metadata: { run: { agent_kind: 'openclaw', turn_id: 'native-run' } } })).turn, null);
});

test("logical root roles use observation evidence and keep known non-turn records visible", () => {
  const rows = [
    row("primary", { parentObservationId: "0123456789abcdef", tags: ["codex", "subagent:lifecycle", "subagent:finished"] }),
    row("tool", { type: "TOOL", name: "exec_command", metadata: { runtime_revision: "revision-digest", execution_role: "operation" }, input: null, output: null }),
    row("started", { name: "Codex Subagent Started", metadata: {}, input: null, output: null }),
    row("finished", { name: "Codex Subagent Finished", metadata: {}, input: null, output: null }),
  ];
  const report = reportFor(stateFor(rows));
  assert.equal(report.counts.roots, 4);
  assert.equal(report.counts.primary_turn_roots, 1);
  assert.equal(report.counts.tool_roots, 1);
  assert.equal(report.counts.subagent_lifecycle_roots, 2);
  assert.equal(report.counts.unknown_role_roots, 0);
  assert.deepEqual(report.by_agent_role.codex, { primary_turn: 1, tool: 1, subagent_lifecycle: 2, unknown: 0 });
  assert.equal(report.primary_turns_by_agent.codex, 1);
  assert.equal(report.counts.missing_input, 0);
  assert.equal(report.counts.missing_output, 0);
  assert.equal(report.counts.missing_metadata, 0);
  assert.equal(report.gates.e14_codex_duplicate_free.roots, 1);
  assert.equal(report.gates.e14_codex_duplicate_free.passed, true);
  assert.equal(report.passed, true);
  const noTurns = reportFor(stateFor(rows.slice(1)));
  assert.equal(noTurns.passed, false);
  assert.equal(noTurns.gates.e14_codex_duplicate_free.passed, false);
});

test("unknown names/types and role disagreements block proof, including unrecognized revision records", () => {
  const cases = [
    { name: "New Agent" },
    { name: "Codex Turn Revision", metadata: { runtime_revision: "revision-digest" } },
    { name: "Codex Turn Revision", metadata: { record_role: "revision" } },
    { type: "EVENT" },
    { type: undefined },
    { type: "TOOL" }, // The name still declares a primary turn.
    { metadata: { run: { turn_index: 2, record_role: "subagent_lifecycle" } } },
    { metadata: { record_role: "primary_turn", run: { record_role: "tool" } } },
    { metadata: { record_role: "unsupported" } },
    { metadata: { record_role: null } },
    { name: "New Agent", tags: ["codex", "subagent:lifecycle"] },
  ];
  for (const extra of cases) {
    const report = reportFor(stateFor([row("good"), row("unknown", extra)]));
    assert.equal(report.counts.unknown_record_role, 1, JSON.stringify(extra));
    assert.equal(report.counts.roots, 2);
    assert.equal(report.passed, false);
    assert.equal(report.gates.e14_codex_duplicate_free.passed, false);
  }
  for (const extra of [
    { metadata: { record_role: "primary_turn", run: { turn_index: 1, record_role: "primary_turn" } } },
    { name: "Explicit Turn", metadata: { run: { turn_index: 1, record_role: "primary_turn" } } },
    { metadata: JSON.stringify({ record_role: "primary_turn", run: JSON.stringify({ turn_index: 1 }) }) },
  ]) assert.equal(reportFor(stateFor([row("explicit", extra)])).passed, true);
  assert.equal(summarizeRoot(row("lifecycle", { name: "Codex Subagent Finished", metadata: { record_role: "subagent_lifecycle" } })).record_role, "subagent_lifecycle");
  assert.equal(summarizeRoot(row("tool", { name: "exec", type: "TOOL", metadata: { record_role: "tool", run: { record_role: "tool" } } })).record_role, "tool");
  const openclawUnknown = reportFor(stateFor([row("good"), row("unknown", { name: "New OpenClaw record", tags: ["openclaw"] })]));
  assert.equal(openclawUnknown.passed, false);
  assert.equal(openclawUnknown.gates.e14_codex_duplicate_free.passed, true);
});

test("producer sources must agree and a known name cannot invent missing attribution", () => {
  for (const extra of [
    { tags: [] },
    { tags: ["agent:other"] },
    { tags: ["agent:codex", "openclaw"] },
    { tags: ["agent:openclaw", "codex"] },
    { tags: ["agent:codex", "agent:openclaw"] },
    { tags: ["codex"], metadata: { run: { turn_index: 2, agent_kind: "openclaw" } } },
    { tags: ["codex"], metadata: { run: { turn_index: 2, agent_kind: "other" } } },
    { tags: ["codex"], metadata: { run: { turn_index: 2, agent_kind: "" } } },
    { tags: ["openclaw"] }, // Contradicts the Codex name.
    { type: "TOOL", name: "exec", tags: [], metadata: {} },
  ]) {
    const summarized = summarizeRoot(row("bad", extra));
    assert.equal(summarized.agent, "unknown", JSON.stringify(extra));
    assert.equal(summarized.turn, null);
    const report = reportFor(stateFor([row("good"), row("bad", extra)]));
    assert.equal(report.counts.unattributed_roots, 1);
    assert.equal(report.passed, false);
    assert.equal(report.gates.e14_codex_duplicate_free.passed, false);
  }
  assert.equal(summarizeRoot(row("agree", { tags: ["codex", "agent:codex", null], metadata: { run: { agent_kind: "codex", turn_index: 1 } } })).agent, "codex");
  assert.equal(summarizeRoot(row("canonical", { tags: [], metadata: { run: { agent_kind: "codex", turn_index: 1 } } })).agent, "codex");
  assert.equal(summarizeRoot(row("conflict", { tags: ["agent:codex", "openclaw"] })).producer_conflict, true);
});

test("OpenClaw cannot borrow Codex identity fields or a legacy run_id", () => {
  for (const run of [{ turn_index: 1 }, { turn_id: "run" }, { agent_kind: "openclaw", turn_index: 1 }, { agent_kind: "openclaw", turn_id: " " }]) {
    const report = reportFor(stateFor([row("oc", { name: "OpenClaw turn", tags: ["openclaw"], metadata: { run, run_id: "random", "codex.turn_id": "foreign" } })]));
    assert.equal(report.counts.unknown_turn_identity, 1);
    assert.equal(report.passed, false);
  }
  const canonical = row("oc", { name: "OpenClaw turn", tags: [], metadata: { run: { agent_kind: "openclaw", turn_id: "stable" } } });
  assert.equal(reportFor(stateFor([canonical])).passed, true);
  // Identity namespaces remain producer-specific, even with matching session/turn IDs.
  const codex = row("codex", { metadata: { run: { agent_kind: "codex" }, "codex.turn_id": "stable" } });
  assert.equal(reportFor(stateFor([canonical, codex])).counts.duplicate_turn_traces, 0);
  for (const extra of [{ metadata: { "codex.turn_id": " " } }, { sessionId: " " }]) {
    assert.equal(reportFor(stateFor([row("empty-id", extra)])).counts.unknown_turn_identity, 1);
  }
});

test("multiple primary roots in one trace remain visible and fail closed, even with revision metadata", () => {
  for (const turn_index of [1, 2]) {
    const report = reportFor(stateFor([row("a"), row("revision", { traceId: "trace-a", metadata: { run: { turn_index }, runtime_revision: "new-revision" } })]));
    assert.equal(report.counts.primary_turn_roots, 2);
    assert.equal(report.counts.multiple_primary_root_traces, 1);
    assert.equal(report.counts.duplicate_turn_roots, turn_index === 1 ? 1 : 0);
    assert.equal(report.counts.duplicate_turn_traces, 0);
    assert.equal(report.passed, false);
    assert.equal(report.gates.e14_codex_duplicate_free.passed, false);
  }
  const sameTraceTools = reportFor(stateFor([row("a"), row("tool", { name: "exec", type: "TOOL", traceId: "trace-a" })]));
  assert.equal(sameTraceTools.counts.multiple_primary_root_traces, 0);
  assert.equal(sameTraceTools.passed, true);
  const mixed = reportFor(stateFor([row("a"), row("oc", { traceId: "trace-a", name: "OpenClaw turn", tags: ["openclaw"], metadata: { run: { agent_kind: "openclaw", turn_id: "native" } } })]));
  assert.equal(mixed.counts.multiple_primary_root_traces, 1);
  assert.equal(mixed.gates.e14_codex_duplicate_free.multiple_primary_root_traces, 1);
  assert.equal(mixed.gates.e14_codex_duplicate_free.passed, false);
});

test("aborted/interrupted diagnostics do not weaken missing IO, metadata or unfinished gates", () => {
  const report = reportFor(stateFor([
    row("aborted", { input: null, output: null, metadata: { run: { turn_index: 1 }, "codex.aborted": true } }),
    row("interrupted", { output: null, metadata: { run: { turn_index: 2, status: "interrupted" } } }),
  ]));
  assert.equal(report.counts.aborted, 1);
  assert.equal(report.counts.interrupted, 1);
  assert.equal(report.counts.missing_input, 1);
  assert.equal(report.counts.missing_output, 2);
  assert.equal(report.counts.missing_output_aborted, 1);
  assert.equal(report.counts.missing_output_interrupted, 1);
  assert.equal(report.missing_output_rate, 1);
  assert.equal(report.passed, false);
  assert.equal(report.gates.e14_codex_duplicate_free.passed, true); // Identity proof is not IO/task success.
  const noMetadata = reportFor(stateFor([row("legacy", { metadata: { "codex.turn_id": "known" } })]));
  assert.equal(noMetadata.counts.unknown_turn_identity, 0);
  assert.equal(noMetadata.counts.missing_metadata, 1);
  assert.equal(noMetadata.passed, false);
  const unfinished = reportFor(stateFor([row("done"), row("pending", { endTime: null, metadata: { run: { turn_index: 2 } } })]));
  assert.equal(unfinished.counts.unfinished, 1);
  assert.equal(unfinished.passed, false);
  assert.equal(unfinished.gates.e14_codex_duplicate_free.passed, false);
  assert.equal(reportFor(stateFor([row("done")], { complete: false })).passed, false);
  const heartbeat = reportFor(stateFor([row("done"), row("heartbeat", { tags: ["heartbeat"], input: null, output: null, metadata: {} })]));
  assert.equal(heartbeat.counts.heartbeat, 1);
  assert.equal(heartbeat.passed, true);
});

test("repeated page observations, including changed revisions, cannot prove a clean audit", async t => {
  const out = await mkdtemp(join(tmpdir(), "langfuse-quality-")); t.after(() => rm(out, { recursive: true, force: true }));
  const api = { origin: "https://example.invalid", async request(path) {
    if (path.endsWith("projects")) return { data: [{ id: "test-project" }] };
    const url = new URL(path, this.origin);
    assert.equal(url.searchParams.get("isRootObservation"), "true");
    assert.equal(url.searchParams.get("fields"), "core,basic,io,metadata,trace_context");
    assert.equal(url.searchParams.get("expandMetadata"), "run,quality,gisul");
    return url.searchParams.has("cursor") ? { data: [row("a", { metadata: { run: { turn_index: 2 }, runtime_revision: "changed" } })], meta: {} } : { data: [row("a")], meta: { cursor: "next" } };
  } };
  const report = await collectQuality({ api, projectId: "test-project", date: "2020-01-01", out });
  assert.equal(report.counts.roots, 1);
  assert.equal(report.counts.repeated_identity_rows, 1);
  assert.equal(report.passed, false);
  assert.equal(report.gates.e14_codex_duplicate_free.passed, false);
});

test("old or relabeled checkpoints are refused without overwriting the frozen report or day", async t => {
  const out = await mkdtemp(join(tmpdir(), "langfuse-quality-")); t.after(() => rm(out, { recursive: true, force: true }));
  const prefix = join(out, "2026-09-17-Asia-Seoul");
  const retainedReport = JSON.stringify({ date: "2026-09-17", passed: false, gates: { e14_codex_duplicate_free: { roots: 144, unknown_turn_identity: 13, duplicate_turn_traces: 1, passed: false } } });
  await writeFile(`${prefix}.json`, retainedReport);
  const api = { origin: "https://example.invalid", async request(path) {
    assert.equal(path, "/api/public/projects");
    return { data: [{ id: "test-project" }] };
  } };
  for (const schema_version of [undefined, 1, 2, CHECKPOINT_SCHEMA, 99]) {
    const oldRow = summarizeRoot(row("old"));
    delete oldRow.record_role;
    const old = stateFor([], { schema_version, project_id: "test-project", origin: api.origin, date: "2026-09-17", timezone: "Asia/Seoul", window: windowFor("2026-09-17", "Asia/Seoul"), rows: { old: oldRow } });
    const bytes = JSON.stringify(old);
    await writeFile(`${prefix}.checkpoint.json`, bytes);
    assert.throws(() => reportFor(old), /role schema 3/);
    await assert.rejects(collectQuality({ api, projectId: "test-project", date: "2026-09-17", out }), /retain old evidence/);
    assert.equal(await readFile(`${prefix}.checkpoint.json`, "utf8"), bytes);
    assert.equal(await readFile(`${prefix}.json`, "utf8"), retainedReport);
  }
});

test("unfinished calendar days are rejected before fetching", async () => {
  await assert.rejects(collectQuality({ date: "2026-09-22", now: () => Date.parse("2026-09-22T05:00:00Z"), api: { request() { assert.fail("must not fetch"); } } }), /completed calendar day/);
});

const frozenDir = process.env.LANGFUSE_QUALITY_FROZEN_DIR;
test("frozen fully paginated evidence preserves Sep17 failure and corrects Sep21 turn counts", { skip: !frozenDir }, async t => {
  const bytes = await readFile(join(frozenDir, "roots.json"));
  const frozen = JSON.parse(bytes), expected = JSON.parse(await readFile(join(frozenDir, "summary.json"), "utf8"));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.roots_sha256);
  assert.equal(frozen.complete, true);
  // This archive stores minimized IO flags. Adapt them in memory only: do not
  // teach production code to interpret arbitrary prompt objects as IO flags.
  const rows = Object.values(frozen.rows).map(r => {
    assert.equal(typeof r.input.missing, "boolean");
    assert.equal(typeof r.output.missing, "boolean");
    return { ...r, input: r.input.missing ? null : "present", output: r.output.missing ? null : "present" };
  });
  const report = reportFor(stateFor(rows, { window: { from: expected.scope.from, to: expected.scope.to }, complete: false }), new Date(expected.scope.observedAt));
  assert.equal(report.complete, false); // An aggregate over the archive is not a calendar-day proof.
  assert.equal(report.counts.roots, 5777);
  assert.equal(report.counts.primary_turn_roots, 887);
  assert.equal(report.counts.tool_roots, 4700);
  assert.equal(report.counts.subagent_lifecycle_roots, 190);
  assert.equal(report.counts.unknown_role_roots, 0);
  assert.equal(report.counts.non_synthetic_primary_turn_roots, 865);
  assert.equal(report.counts.unknown_turn_identity, 387);
  assert.equal(report.counts.duplicate_turn_traces, 1);
  assert.equal(report.counts.missing_input, 15);
  assert.equal(report.counts.missing_output, 29);
  assert.equal(report.counts.missing_output_aborted, 16);
  assert.equal(report.passed, false);
  const replay = [];
  for (const date of [...new Set(expected.daily.map(entry => entry.day))]) {
    const window = windowFor(date, "Asia/Seoul");
    const daily = rows.filter(r => Date.parse(r.startTime) >= Date.parse(window.from) && Date.parse(r.startTime) < Date.parse(window.to));
    const result = reportFor(stateFor(daily, { date, window }), new Date(expected.scope.observedAt));
    const codex = expected.daily.find(entry => entry.day === date && entry.producer === "Codex Turn");
    const openclaw = expected.daily.find(entry => entry.day === date && entry.producer === "OpenClaw turn");
    const gate = result.gates.e14_codex_duplicate_free;
    assert.equal(gate.roots, codex.production, date);
    assert.equal(gate.unknown_turn_identity, codex.unknown_identity, date);
    assert.equal(gate.duplicate_turn_traces, codex.duplicate_trace_extras, date);
    assert.equal(result.counts.missing_output, codex.missing_output + openclaw.missing_output, date);
    assert.equal(result.counts.missing_output_aborted, codex.missing_output_aborted, date);
    assert.equal(result.counts.unknown_turn_identity, codex.unknown_identity + openclaw.unknown_identity, date);
    assert.equal(result.full_day, codex.full_day);
    assert.equal(result.passed, false); // Legacy OpenClaw identities remain unknown on every day.
    if (date === "2026-09-17") {
      assert.equal(gate.roots, 144); assert.equal(gate.unknown_turn_identity, 13); assert.equal(gate.duplicate_turn_traces, 1); assert.equal(gate.passed, false);
    }
    if (date === "2026-09-21") assert.equal(gate.roots, 135);
    if (!result.full_day) assert.equal(gate.passed, false);
    replay.push({ date, codex: gate.roots, openclaw: result.primary_turns_by_agent.openclaw, unknown: result.counts.unknown_turn_identity, duplicate_extra: gate.duplicate_turn_traces, e14: gate.passed, quality: result.passed });
  }
  t.diagnostic(JSON.stringify({ roots: report.counts.roots, roles: { primary: 887, tool: 4700, lifecycle: 190, unknown: 0 }, production_turns: 865, missing_input: 15, missing_output: 29, missing_output_aborted: 16, replay }));
});
