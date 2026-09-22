import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { langfuseApi } from "./langfuse-api.mjs";

const object = value => { if (typeof value === "string") { try { value = JSON.parse(value); } catch { return {}; } } return value && typeof value === "object" && !Array.isArray(value) ? value : {}; };
const missing = value => value === undefined || value === null || (typeof value === "string" && ["", "null", '""'].includes(value.trim()));
const identifier = value => typeof value === "string" && !missing(value) ? value : null;
export const CHECKPOINT_SCHEMA = 3;
const roles = ["primary_turn", "tool", "subagent_lifecycle", "unknown"];
const aliases = new Map([
  ["Codex Turn", { role: "primary_turn", agent: "codex" }],
  ["OpenClaw turn", { role: "primary_turn", agent: "openclaw" }],
  ["Codex Subagent Started", { role: "subagent_lifecycle", agent: "codex" }],
  ["Codex Subagent Finished", { role: "subagent_lifecycle", agent: "codex" }],
]);
function recordRole(row, meta, run) {
  const alias = aliases.get(row.name);
  const declarations = [meta.record_role, run.record_role].filter(value => value !== undefined);
  // Trace tags are inherited by tools and actual subagent turns. Neither a
  // lifecycle tag nor runtime_revision identifies an observation's record role.
  const candidates = [...declarations, ...(alias ? [alias.role] : []), ...(row.type === "TOOL" ? ["tool"] : [])];
  if (!candidates.length || candidates.some(role => !roles.includes(role) || role === "unknown") || new Set(candidates).size !== 1) return "unknown";
  const role = candidates[0];
  return row.type === (role === "tool" ? "TOOL" : "AGENT") ? role : "unknown";
}
function requireCheckpointSchema(state) {
  const flags = ["synthetic", "heartbeat", "missing_input", "missing_output", "metadata_present", "unfinished", "producer_conflict", "aborted", "interrupted"];
  if (state.schema_version !== CHECKPOINT_SCHEMA || !state.rows || typeof state.rows !== "object" || Array.isArray(state.rows) ||
      !Number.isInteger(state.repeated_rows) || state.repeated_rows < 0 ||
      Object.values(state.rows).some(row => !row || !roles.includes(row.record_role) || !["codex", "openclaw", "unknown"].includes(row.agent) || flags.some(key => typeof row[key] !== "boolean"))) {
    throw new Error("Checkpoint requires role schema 3; retain old evidence and recollect the same day in a new --out directory (do not relabel or migrate rows)");
  }
}
function identityCounts(rows) {
  const identities = new Map();
  for (const row of rows) if (row.session_id && row.turn) {
    const key = JSON.stringify([row.agent, row.session_id, row.turn]);
    if (!identities.has(key)) identities.set(key, []);
    identities.get(key).push(row);
  }
  return {
    identified_turns: identities.size,
    unknown_turn_identity: rows.filter(row => !row.session_id || !row.turn).length,
    duplicate_turn_traces: [...identities.values()].reduce((sum, group) => sum + new Set(group.map(row => row.trace_id)).size - 1, 0),
    duplicate_turn_roots: [...identities.values()].reduce((sum, group) => sum + group.length - 1, 0),
  };
}
const multiplePrimaryTraces = (rows, agent) => {
  const traces = new Map();
  for (const row of rows) {
    if (!traces.has(row.trace_id)) traces.set(row.trace_id, []);
    traces.get(row.trace_id).push(row);
  }
  return [...traces.values()].filter(group => group.length > 1 && (!agent || group.some(row => row.agent === agent))).length;
};
export function windowFor(date, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !["Asia/Seoul", "UTC"].includes(tz)) throw new Error("Use a YYYY-MM-DD date and Asia/Seoul or UTC timezone");
  const midnight = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0,10) !== date) throw new Error("Invalid calendar date");
  const from = midnight - (tz === "Asia/Seoul" ? 9 * 3600000 : 0);
  return { from: new Date(from).toISOString(), to: new Date(from + 86400000).toISOString() };
}
export function summarizeRoot(row) {
  const meta = object(row.metadata), run = object(meta.run), quality = object(meta.quality), gisul = object(meta.gisul);
  const tags = Array.isArray(row.tags) ? row.tags.filter(tag => typeof tag === "string") : [];
  const synthetic = quality.synthetic === true || tags.includes("synthetic");
  const heartbeat = quality.heartbeat === true || tags.includes("heartbeat");
  const declaredAgents = [...new Set(tags.filter(tag => tag.startsWith("agent:")).map(tag => tag.slice(6)))];
  const legacyAgents = ["codex", "openclaw"].filter(agent => tags.includes(agent));
  const agents = [...new Set([...declaredAgents, ...legacyAgents, ...(run.agent_kind !== undefined ? [run.agent_kind] : [])])];
  const namedAgent = aliases.get(row.name)?.agent;
  const producerConflict = agents.length > 1 || (agents.length === 1 && namedAgent !== undefined && agents[0] !== namedAgent);
  const agent = !producerConflict && agents.length === 1 && ["codex", "openclaw"].includes(agents[0]) ? agents[0] : "unknown";
  const role = recordRole(row, meta, run);
  // Legacy OpenClaw run_id can be a collector-generated random fallback. Only
  // the canonical producer's explicit turn_id establishes a stable identity.
  let turn = null;
  if (role === "primary_turn" && agent === "codex") {
    turn = Number.isInteger(run.turn_index) && run.turn_index >= 0 ? `index:${run.turn_index}` : identifier(meta["codex.turn_id"]) ? `id:${meta["codex.turn_id"]}` : null;
  } else if (role === "primary_turn" && agent === "openclaw" && run.agent_kind === "openclaw" && identifier(run.turn_id)) {
    turn = `id:${run.turn_id}`;
  }
  return { id: row.id, trace_id: row.traceId, session_id: identifier(row.sessionId) ?? (agent === "codex" ? identifier(meta["codex.thread_id"]) : null), turn, start_time: row.startTime,
    missing_input: missing(row.input), missing_output: missing(row.output), synthetic, heartbeat,
    agent, record_role: role, producer_conflict: producerConflict,
    aborted: meta["codex.aborted"] === true || quality.aborted === true || run.status === "aborted",
    interrupted: meta["codex.interrupted"] === true || quality.interrupted === true || run.status === "interrupted",
    device: tags.find(tag => tag.startsWith("device:"))?.slice(7) ?? meta.device_id ?? "unknown",
    gisul_loads: Array.isArray(gisul.loads) ? gisul.loads.length : 0, gisul_partial: quality.gisul_join === "partial",
    missing_release: quality.missing_gisul_release === true, release: typeof gisul.release === "string" ? gisul.release : null,
    metadata_present: Object.keys(run).length > 0, unfinished: !row.endTime, truncated: quality.truncated === true };
}
export function reportFor(state, now = new Date()) {
  requireCheckpointSchema(state);
  const rows = Object.values(state.rows), production = rows.filter(x => !x.synthetic && !x.heartbeat);
  const primary = production.filter(x => x.record_role === "primary_turn"), eligible = primary.filter(x => !x.unfinished);
  const counts = { roots: rows.length, traces: new Set(rows.map(x=>x.trace_id)).size, synthetic: rows.filter(x=>x.synthetic).length,
    heartbeat: rows.filter(x=>x.heartbeat && !x.synthetic).length, non_synthetic_roots: production.length,
    primary_turn_roots: rows.filter(x=>x.record_role === "primary_turn").length,
    tool_roots: rows.filter(x=>x.record_role === "tool").length,
    subagent_lifecycle_roots: rows.filter(x=>x.record_role === "subagent_lifecycle").length,
    unknown_role_roots: rows.filter(x=>x.record_role === "unknown").length,
    non_synthetic_primary_turn_roots: primary.length, unknown_record_role: production.filter(x=>x.record_role === "unknown").length,
    unattributed_roots: production.filter(x=>x.agent === "unknown").length,
    conflicting_producer_roots: production.filter(x=>x.producer_conflict).length,
    unfinished: primary.length - eligible.length, ...identityCounts(eligible),
    multiple_primary_root_traces: multiplePrimaryTraces(primary), repeated_identity_rows: state.repeated_rows,
    missing_input: eligible.filter(x=>x.missing_input).length, missing_output: eligible.filter(x=>x.missing_output).length,
    aborted: eligible.filter(x=>x.aborted).length, interrupted: eligible.filter(x=>x.interrupted).length,
    missing_output_aborted: eligible.filter(x=>x.missing_output && x.aborted).length,
    missing_output_interrupted: eligible.filter(x=>x.missing_output && x.interrupted).length,
    missing_metadata: eligible.filter(x=>!x.metadata_present).length, gisul_loaded: eligible.filter(x=>x.gisul_loads).length,
    gisul_partial: eligible.filter(x=>x.gisul_partial).length, missing_release: eligible.filter(x=>x.missing_release).length };
  const fullDay = Date.parse(state.window.to) <= now.getTime();
  const complete = state.complete === true && fullDay;
  const eligibleCount = eligible.length;
  const codex = eligible.filter(row => row.agent === "codex");
  const codexGate = {
    scope: "All explicitly attributed non-synthetic, non-heartbeat Codex primary turns in this complete calendar day, including actual subagent turns. Tool and subagent lifecycle records remain in role counts; OpenClaw has its own collector.",
    checkpoint_schema: state.schema_version,
    roots: codex.length, ...identityCounts(codex),
    multiple_primary_root_traces: multiplePrimaryTraces(primary, "codex"),
    unfinished_codex: primary.filter(row => row.agent === "codex" && row.unfinished).length,
    unknown_record_role: production.filter(row => row.record_role === "unknown" && row.agent !== "openclaw").length,
    unattributed_roots: counts.unattributed_roots, conflicting_producer_roots: counts.conflicting_producer_roots,
    repeated_identity_rows: state.repeated_rows,
  };
  const codexPassed = complete && codex.length > 0 &&
    !["unknown_turn_identity", "duplicate_turn_traces", "duplicate_turn_roots", "multiple_primary_root_traces", "unfinished_codex", "unknown_record_role", "unattributed_roots", "conflicting_producer_roots", "repeated_identity_rows"].some(key => codexGate[key]);
  return { version: 3, checkpoint_schema: state.schema_version, generated_at: now.toISOString(), project_id: state.project_id, origin: state.origin, date: state.date, timezone: state.timezone,
    source: "observations-v2-logical-roots", window: state.window, complete, full_day: fullDay, fetched_pages: state.pages, counts,
    missing_input_rate: eligibleCount ? counts.missing_input / eligibleCount : null,
    missing_output_rate: eligibleCount ? counts.missing_output / eligibleCount : null,
    by_agent: Object.fromEntries([...new Set(rows.map(x=>x.agent))].map(agent => [agent, rows.filter(x=>x.agent===agent).length])),
    by_agent_role: Object.fromEntries([...new Set(rows.map(x=>x.agent))].map(agent => [agent, Object.fromEntries(roles.map(role => [role, rows.filter(x=>x.agent === agent && x.record_role === role).length]))])),
    primary_turns_by_agent: Object.fromEntries([...new Set(primary.map(x=>x.agent))].map(agent => [agent, primary.filter(x=>x.agent === agent).length])),
    gates: { e14_codex_duplicate_free: { ...codexGate, passed: codexPassed } },
    passed: complete && eligibleCount > 0 && !["duplicate_turn_traces","duplicate_turn_roots","multiple_primary_root_traces","repeated_identity_rows","unknown_turn_identity","unknown_record_role","unattributed_roots","conflicting_producer_roots","unfinished","missing_input","missing_output","missing_metadata"].some(key=>counts[key]),
    limitations: ["Logical roots include primary turns, tools, lifecycle and unknown records; IO and identity metrics cover completed non-synthetic, non-heartbeat primary turns only.", "Unmarked synthetic/heartbeat traffic cannot be inferred safely from prompt text.", "Unknown roles or producers block the relevant gates; unknown identities, ambiguous primary roots and no-data days cannot prove zero duplicates.", "Aborted/interrupted flags are diagnostic: missing final output still fails quality, and output presence does not establish task success.", "Schema 3 requires fresh role evidence; retained failed reports and their original dates are not superseded."] };
}
async function atomicJson(file, value) { await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }); await rename(`${file}.tmp`, file); }
export async function collectQuality({ api, projectId, date, tz = "Asia/Seoul", out, now = () => Date.now() }) {
  const window = windowFor(date, tz);
  if (Date.parse(window.to) > now()) throw new Error("Daily audits require a completed calendar day");
  const projects = await api.request("/api/public/projects");
  if (projects.data?.length !== 1 || projects.data[0].id !== projectId) throw new Error("Langfuse project identity does not match the requested project");
  await mkdir(out, { recursive: true });
  const prefix = join(out, `${date}-${tz.replaceAll("/", "-")}`), lock = `${prefix}.lock`;
  await mkdir(lock);
  const checkpoint = `${prefix}.checkpoint.json`;
  try {
    let state = { schema_version: CHECKPOINT_SCHEMA, project_id: projectId, origin: api.origin, date, timezone: tz, window, cursor: null, rows: {}, pages: 0, repeated_rows: 0, complete: false };
    try { state = JSON.parse(await readFile(checkpoint, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (state.project_id !== projectId || state.origin !== api.origin || state.date !== date || state.timezone !== tz || state.window?.from !== window.from || state.window?.to !== window.to) throw new Error("Checkpoint belongs to another query");
    requireCheckpointSchema(state);
    if (state.resume_after && Date.parse(state.resume_after) > now()) {
      const error = new Error(`Rate limited; resume after ${state.resume_after}`); error.status = 429; throw error;
    }
    while (!state.complete) {
      const params = new URLSearchParams({ fields: "core,basic,io,metadata,trace_context", expandMetadata: "run,quality,gisul", isRootObservation: "true", limit: "100", fromStartTime: window.from, toStartTime: window.to });
      if (state.cursor) params.set("cursor", state.cursor);
      let page;
      try { page = await api.request(`/api/public/v2/observations?${params}`); }
      catch (error) {
        if (error.status === 429) {
          const seconds = Number(error.retryAfter);
          const retryAt = error.retryAfter && !Number.isFinite(seconds) ? Date.parse(error.retryAfter) : now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
          state.resume_after = new Date(Number.isFinite(retryAt) ? retryAt : now() + 60000).toISOString();
        }
        await atomicJson(checkpoint, state);
        await atomicJson(`${prefix}.json`, { ...reportFor(state, new Date(now())), error: { status: error.status ?? null, retry_after: error.retryAfter ?? null } });
        throw error;
      }
      if (!Array.isArray(page.data) || !page.meta || page.data.some(row=>row.projectId !== projectId || !row.id || !row.traceId)) throw new Error("Unexpected observations response");
      for (const row of page.data) {
        const key = `${row.traceId}/${row.id}`;
        if (state.rows[key]) state.repeated_rows++;
        else state.rows[key] = summarizeRoot(row);
      }
      const next = page.meta.cursor ?? null;
      if (next && next === state.cursor) throw new Error("Repeated pagination cursor");
      state.cursor = next; state.pages++; state.complete = !next; state.resume_after = null;
      await atomicJson(checkpoint, state);
    }
    const report = reportFor(state, new Date(now()));
    await atomicJson(`${prefix}.json`, report);
    const gate = report.gates.e14_codex_duplicate_free;
    const countTable = entries => `| Metric | Count |\n| --- | ---: |\n${entries.map(([key, value]) => `| ${key} | ${value} |`).join("\n")}`;
    await writeFile(`${prefix}.md`, `# Langfuse quality ${date} (${tz})

Project: ${projectId}. API: logical root observations v2. Full day: ${report.full_day}. Passed: ${report.passed}.

${countTable(Object.entries(report.counts))}

## Roots by producer and role

| Producer | Primary turns (all) | Tools | Subagent lifecycle | Unknown role | Primary turns (non-synthetic, non-heartbeat) |
| --- | ---: | ---: | ---: | ---: | ---: |
${Object.entries(report.by_agent_role).map(([agent, counts]) => `| ${agent} | ${counts.primary_turn} | ${counts.tool} | ${counts.subagent_lifecycle} | ${counts.unknown} | ${report.primary_turns_by_agent[agent] ?? 0} |`).join("\n")}

## E-14 Codex duplicate gate

${gate.scope}

Passed: ${gate.passed}. This does not replace the overall quality result.

${countTable(Object.entries(gate).filter(([, value]) => typeof value === "number"))}

${report.limitations.map(x=>`- ${x}`).join("\n")}
`);
    return report;
  } finally { await rm(lock, { recursive: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), value = key => args[args.indexOf(key) + 1];
  const tz = args.includes("--tz") ? value("--tz") : "Asia/Seoul";
  const date = args.includes("--date") ? value("--date") : new Date(Date.now() + (tz === "Asia/Seoul" ? 9 : 0) * 3600000 - 86400000).toISOString().slice(0,10);
  const projectId = args.includes("--project") ? value("--project") : process.env.LANGFUSE_PROJECT_ID;
  if (!projectId) throw new Error("--project is required; credential identity alone is not target selection");
  const out = args.includes("--out") ? resolve(value("--out")) : fileURLToPath(new URL("../eval/out/quality", import.meta.url));
  const report = await collectQuality({ api: await langfuseApi(), projectId, date, tz, out });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 2;
}
