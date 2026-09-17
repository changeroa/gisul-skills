import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { langfuseApi } from "./langfuse-api.mjs";

const object = value => { if (typeof value === "string") { try { value = JSON.parse(value); } catch { return {}; } } return value && typeof value === "object" && !Array.isArray(value) ? value : {}; };
const missing = value => value === undefined || value === null || (typeof value === "string" && ["", "null", '""'].includes(value.trim()));
export function windowFor(date, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !["Asia/Seoul", "UTC"].includes(tz)) throw new Error("Use a YYYY-MM-DD date and Asia/Seoul or UTC timezone");
  const midnight = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0,10) !== date) throw new Error("Invalid calendar date");
  const from = midnight - (tz === "Asia/Seoul" ? 9 * 3600000 : 0);
  return { from: new Date(from).toISOString(), to: new Date(from + 86400000).toISOString() };
}
export function summarizeRoot(row) {
  const meta = object(row.metadata), run = object(meta.run), quality = object(meta.quality), gisul = object(meta.gisul);
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const synthetic = quality.synthetic === true || tags.includes("synthetic");
  const heartbeat = quality.heartbeat === true || tags.includes("heartbeat");
  const declaredAgents = [...new Set(tags.filter(tag => tag.startsWith("agent:")).map(tag => tag.slice(6)))];
  const legacyAgents = ["codex", "openclaw"].filter(agent => tags.includes(agent));
  const agents = declaredAgents.length ? declaredAgents : legacyAgents;
  const turn = Number.isInteger(run.turn_index) ? `index:${run.turn_index}` : typeof meta["codex.turn_id"] === "string" ? `id:${meta["codex.turn_id"]}` : null;
  return { id: row.id, trace_id: row.traceId, session_id: row.sessionId ?? meta["codex.thread_id"] ?? null, turn, start_time: row.startTime,
    missing_input: missing(row.input), missing_output: missing(row.output), synthetic, heartbeat,
    agent: agents.length === 1 ? agents[0] : "unknown",
    device: tags.find(tag => tag.startsWith("device:"))?.slice(7) ?? meta.device_id ?? "unknown",
    gisul_loads: Array.isArray(gisul.loads) ? gisul.loads.length : 0, gisul_partial: quality.gisul_join === "partial",
    missing_release: quality.missing_gisul_release === true, release: typeof gisul.release === "string" ? gisul.release : null,
    metadata_present: Object.keys(run).length > 0, unfinished: !row.endTime, truncated: quality.truncated === true };
}
export function reportFor(state, now = new Date()) {
  const rows = Object.values(state.rows), production = rows.filter(x => !x.synthetic && !x.heartbeat);
  const eligible = production.filter(x => !x.unfinished), identities = new Map();
  for (const row of eligible) if (row.session_id && row.turn) {
    const key = `${row.session_id}/${row.turn}`;
    if (!identities.has(key)) identities.set(key, new Set());
    identities.get(key).add(row.trace_id);
  }
  const counts = { roots: rows.length, traces: new Set(rows.map(x=>x.trace_id)).size, synthetic: rows.filter(x=>x.synthetic).length,
    heartbeat: rows.filter(x=>x.heartbeat && !x.synthetic).length, non_synthetic_roots: production.length, unfinished: production.length - eligible.length,
    identified_turns: identities.size, unknown_turn_identity: eligible.filter(x=>!x.turn || !x.session_id).length,
    duplicate_turn_traces: [...identities.values()].reduce((sum, ids)=>sum + ids.size - 1, 0), repeated_identity_rows: state.repeated_rows,
    missing_input: eligible.filter(x=>x.missing_input).length, missing_output: eligible.filter(x=>x.missing_output).length,
    missing_metadata: eligible.filter(x=>!x.metadata_present).length, gisul_loaded: eligible.filter(x=>x.gisul_loads).length,
    gisul_partial: eligible.filter(x=>x.gisul_partial).length, missing_release: eligible.filter(x=>x.missing_release).length };
  const fullDay = Date.parse(state.window.to) <= now.getTime();
  const complete = state.complete && fullDay;
  const eligibleCount = eligible.length;
  const codex = eligible.filter(row => row.agent === "codex"), codexIdentities = new Map();
  for (const row of codex) if (row.session_id && row.turn) {
    const key = `${row.session_id}/${row.turn}`;
    if (!codexIdentities.has(key)) codexIdentities.set(key, new Set());
    codexIdentities.get(key).add(row.trace_id);
  }
  const codexGate = {
    scope: "All explicitly attributed non-synthetic, non-heartbeat Codex roots in this complete calendar day; OpenClaw has its own collector.",
    checkpoint_schema: state.schema_version ?? 1,
    roots: codex.length, identified_turns: codexIdentities.size,
    unknown_turn_identity: codex.filter(row => !row.session_id || !row.turn).length,
    duplicate_turn_traces: [...codexIdentities.values()].reduce((sum, ids) => sum + ids.size - 1, 0),
    unfinished_codex: production.filter(row => row.agent === "codex" && row.unfinished).length,
    unattributed_roots: production.filter(row => row.agent === "unknown").length,
    repeated_identity_rows: state.repeated_rows,
  };
  const codexPassed = complete && state.schema_version === 2 && codex.length > 0 &&
    !["unknown_turn_identity", "duplicate_turn_traces", "unfinished_codex", "unattributed_roots", "repeated_identity_rows"].some(key => codexGate[key]);
  return { version: 1, generated_at: now.toISOString(), project_id: state.project_id, origin: state.origin, date: state.date, timezone: state.timezone,
    source: "observations-v2-logical-roots", window: state.window, complete, full_day: fullDay, fetched_pages: state.pages, counts,
    missing_input_rate: eligibleCount ? counts.missing_input / eligibleCount : null,
    missing_output_rate: eligibleCount ? counts.missing_output / eligibleCount : null,
    by_agent: Object.fromEntries([...new Set(rows.map(x=>x.agent))].map(agent => [agent, rows.filter(x=>x.agent===agent).length])),
    gates: { e14_codex_duplicate_free: { ...codexGate, passed: codexPassed } },
    passed: complete && eligibleCount > 0 && !["duplicate_turn_traces","repeated_identity_rows","unknown_turn_identity","missing_input","missing_output","missing_metadata"].some(key=>counts[key]),
    limitations: ["Logical root observations measure completed turns; legacy trace-level IO is a separate compatibility surface.", "Unmarked synthetic/heartbeat traffic cannot be inferred safely from prompt text.", "Unknown turn identities prevent a zero-duplicate claim; no-data days do not pass."] };
}
async function atomicJson(file, value) { await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }); await rename(`${file}.tmp`, file); }
export async function collectQuality({ api, projectId, date, tz = "Asia/Seoul", out, now = () => Date.now() }) {
  const window = windowFor(date, tz);
  if (Date.parse(window.to) > Date.now()) throw new Error("Daily audits require a completed calendar day");
  const projects = await api.request("/api/public/projects");
  if (projects.data?.length !== 1 || projects.data[0].id !== projectId) throw new Error("Langfuse project identity does not match the requested project");
  await mkdir(out, { recursive: true });
  const prefix = join(out, `${date}-${tz.replaceAll("/", "-")}`), lock = `${prefix}.lock`;
  await mkdir(lock);
  const checkpoint = `${prefix}.checkpoint.json`;
  try {
    let state = { schema_version: 2, project_id: projectId, origin: api.origin, date, timezone: tz, window, cursor: null, rows: {}, pages: 0, repeated_rows: 0, complete: false };
    try { state = JSON.parse(await readFile(checkpoint, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (state.project_id !== projectId || state.origin !== api.origin || state.date !== date || state.timezone !== tz) throw new Error("Checkpoint belongs to another query");
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
        await atomicJson(`${prefix}.json`, { ...reportFor(state), error: { status: error.status ?? null, retry_after: error.retryAfter ?? null } });
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
    const report = reportFor(state);
    await atomicJson(`${prefix}.json`, report);
    await writeFile(`${prefix}.md`, `# Langfuse quality ${date} (${tz})\n\nProject: ${projectId}. API: logical root observations v2. Full day: ${report.full_day}. Passed: ${report.passed}.\n\n| Metric | Count |\n| --- | ---: |\n${Object.entries(report.counts).map(([key,value])=>`| ${key} | ${value} |`).join("\n")}\n\n## E-14 Codex duplicate gate\n\n${report.gates.e14_codex_duplicate_free.scope}\n\nPassed: ${report.gates.e14_codex_duplicate_free.passed}. This does not replace the overall quality result.\n\n${report.limitations.map(x=>`- ${x}`).join("\n")}\n`);
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
