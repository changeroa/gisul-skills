export const SCORE_VERSION = "formal22-deterministic-v1";

const knownTools = ["search_skills", "load_skill", "read_skill_file", "get_workspace", "list_projects", "get_project", "list_issue_statuses", "list_templates", "get_template", "get_issue", "list_comments", "list_issues", "save_issue", "send_slack_message"];
const completed = value => ["completed", "success", "succeeded"].includes(value);
const toolName = value => {
  const name = String(value ?? "");
  return knownTools.find(tool => name === tool || name.endsWith(`__${tool}`) || name.endsWith(`.${tool}`)) ?? name;
};
const isWrite = tool => /(?:^|[_.])(?:save|create|update|delete|remove|send|post|schedule|edit|write|apply_patch|patch)(?:_|$)/i.test(tool);
const isSlackSend = record => /slack/i.test(`${record.server ?? ""} ${record.tool}`) && /(?:send|post|schedule|reply)/i.test(record.tool) && !/draft/i.test(record.tool);
const isIssueRead = tool => ["get_issue", "list_issues"].includes(tool);
const isLinearRead = tool => ["get_workspace", "list_projects", "get_project", "get_issue", "list_issues", "list_comments"].includes(tool);

function decoded(value) {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return value; }
  }
  if (value?.structuredContent) return value.structuredContent;
  if (Array.isArray(value?.content)) {
    const parts = value.content.filter(part => part.type === "text").map(part => decoded(part.text));
    return parts.length === 1 ? parts[0] : parts;
  }
  return value;
}

function succeeded(value) {
  return value !== undefined && value !== null && !value?.isError && !value?.error && !["failed", "error"].includes(value?.status);
}

function evidence(record) {
  return { source: record.source, tool: record.tool, ...(record.args ? { args: record.args } : {}), ...(record.result !== undefined ? { result: record.result } : {}) };
}

function observations(result) {
  const mockCalls = [], mockResults = [], pending = new Map();
  for (const [index, event] of (result.mockEvents ?? []).entries()) {
    const tool = toolName(event.tool), source = `mockEvents[${index}]`;
    if (event.phase === "call") {
      const call = { tool, args: event.args ?? {}, index, source };
      mockCalls.push(call);
      pending.set(tool, [...(pending.get(tool) ?? []), call]);
    } else if (event.phase === "applied") {
      const call = pending.get(tool)?.shift();
      if (succeeded(event.result) && succeeded(decoded(event.result))) mockResults.push({ tool, args: call?.args, result: decoded(event.result), index, source, callIndex: call?.index });
    }
  }
  const itemCalls = [], itemResults = [];
  for (const [index, item] of (result.items ?? []).entries()) {
    if (!["mcpToolCall", "dynamicToolCall", "mcp_tool_call", "dynamic_tool_call"].includes(item.type)) continue;
    const value = item.result ?? (item.contentItems ? { content: item.contentItems } : undefined);
    const record = { tool: toolName(item.tool ?? item.name), server: item.server, args: decoded(item.arguments ?? item.args ?? {}), source: `items[${index}]`, index };
    itemCalls.push(record);
    if (completed(item.status) && item.success !== false && !item.error && succeeded(value) && succeeded(decoded(value))) itemResults.push({ ...record, result: decoded(value) });
  }
  // Side logs and completed app-server items often describe the same call. Use
  // the larger observed count per tool, without adding duplicate transports.
  const attempts = predicate => {
    const tools = new Set([...mockCalls, ...itemCalls].filter(predicate).map(record => record.tool));
    return [...tools].flatMap(tool => {
      const mock = mockCalls.filter(record => record.tool === tool && predicate(record));
      const items = itemCalls.filter(record => record.tool === tool && predicate(record));
      return mock.length >= items.length ? mock : items;
    });
  };
  return { mockCalls, mockResults, itemCalls, itemResults, attempts, successes: [...mockResults, ...itemResults] };
}

function gisulObservations(result, observed, tool) {
  const logs = (result.gisulEvents ?? []).flatMap((event, index) => {
    const operationName = event.event === "error" ? event.operation : event.event ?? event.tool;
    const operation = operationName === "search" ? "search_skills" : toolName(operationName);
    if (operation !== tool) return [];
    return [{ tool, args: event.args ?? { uri: event.uri }, result: event, source: `gisulEvents[${index}]`, success: event.event !== "error" && event.phase !== "call" && !event.error && !event.code && !event.isError }];
  });
  const items = observed.itemCalls.filter(record => record.tool === tool);
  const successes = [
    ...logs.filter(record => record.success),
    ...observed.itemResults.filter(record => record.tool === tool),
  ];
  return { attempts: logs.length >= items.length ? logs : items, successes, available: Array.isArray(result.gisulEvents) || Array.isArray(result.items) };
}

function issueObjects(value) {
  if (Array.isArray(value)) return value.flatMap(issueObjects);
  if (Array.isArray(value?.issues)) return value.issues.flatMap(issueObjects);
  if (value?.issue) return issueObjects(value.issue);
  return value && typeof value === "object" && (value.id || value.identifier) ? [value] : [];
}

function stage(issue) {
  return typeof issue.status === "string" ? issue.status : issue.status?.name ?? issue.state?.name ?? (typeof issue.state === "string" ? issue.state : undefined);
}

function isDone(issue) {
  return ["completed", "done"].includes(String(issue.statusType ?? issue.status?.type ?? issue.state?.type).toLowerCase()) || /^(?:done|completed|closed|완료)$/i.test(stage(issue) ?? "");
}

function fileMatches(path, expected) {
  return typeof path === "string" && (path.replaceAll("\\", "/") === expected || path.replaceAll("\\", "/").endsWith(`/${expected}`));
}

// Deliberately narrow fallback for app-server versions without commandActions.
// A filename in an echo, model message, failed command or final file snapshot
// is not evidence that the input was read.
function commandReadPaths(command) {
  if (typeof command !== "string") return [];
  const words = command.match(/"(?:\\.|[^"\\])*"|'[^']*'|[^\s]+/g)?.map(word => /^["']/.test(word) ? word.slice(1, -1) : word) ?? [];
  const binary = words[0]?.split("/").at(-1);
  if (["sh", "bash", "zsh"].includes(binary)) {
    const flag = words.findIndex(word => /^-[a-z]*c[a-z]*$/.test(word));
    return flag > 0 && words.length === flag + 2 ? commandReadPaths(words[flag + 1]) : [];
  }
  if (!["cat", "head", "tail", "sed", "nl", "bat"].includes(binary) || /[;$`|&<>]/.test(command)) return [];
  return words.slice(1).filter(word => !word.startsWith("-"));
}

function readsOfFile(result, observed, path) {
  const reads = [];
  for (const [index, item] of (result.items ?? []).entries()) {
    if (!["commandExecution", "command_execution"].includes(item.type) || !completed(item.status) || item.exitCode !== 0 || !String(item.aggregatedOutput ?? item.output ?? "").trim()) continue;
    const paths = [
      ...(item.commandActions ?? []).filter(action => action.type === "read").map(action => action.path ?? action.name),
      ...commandReadPaths(item.command),
    ];
    if (paths.some(candidate => fileMatches(candidate, path))) reads.push({ source: `items[${index}]`, command: item.command, path, exitCode: item.exitCode, output: String(item.aggregatedOutput ?? item.output).slice(0, 500) });
  }
  for (const record of observed.successes) {
    if (!/(?:^|[_.])read_(?:file|text_file|multiple_files)$/.test(record.tool)) continue;
    if ([record.args?.path, record.args?.file_path, ...(record.args?.paths ?? [])].some(candidate => fileMatches(candidate, path))) reads.push(evidence(record));
  }
  return reads;
}

/** Deterministic evidence only. This never creates a human or semantic rating. */
export function scoreCase(item, result = {}) {
  const expected = item?.expected ?? {}, checks = [], observed = observations(result);
  const add = (name, status, detail) => checks.push({ name, status, evidence: detail });
  const hasToolTrace = Array.isArray(result.mockEvents) || Array.isArray(result.items);
  const completedRun = completed(result.status) && !result.failure;
  add("execution", result.failure || ["failed", "error", "cancelled", "canceled", "interrupted", "timeout", "timed_out"].includes(result.status) ? "fail" : completedRun ? "pass" : "unverified", { status: result.status ?? null, failure: result.failure ?? null });
  const usage = result.usage;
  const usageAvailable = usage && typeof usage === "object" && Object.entries(usage).some(([key, value]) => /tokens/i.test(key) && typeof value === "number" && Number.isFinite(value) && value >= 0);
  add("usage", usageAvailable ? "pass" : "unverified", { usage: usage ?? null, ...(usageAvailable ? {} : { reason: "Token usage was not captured." }) });

  const loads = gisulObservations(result, observed, "load_skill"), searches = gisulObservations(result, observed, "search_skills");
  for (const [field, data] of [["max_loads", loads], ["max_searches", searches]]) {
    if (expected[field] === undefined) continue;
    add(field, data.attempts.length > expected[field] ? "fail" : data.available && completedRun ? "pass" : "unverified", { limit: expected[field], count: data.attempts.length, events: data.attempts.map(evidence), complete: data.available && completedRun });
  }
  for (const skill of expected.must_load ?? []) {
    const found = loads.successes.filter(record => {
      const uri = record.result?.uri;
      return typeof uri === "string" && uri.split("/").at(-2) === skill && uri.endsWith("/SKILL.md");
    });
    const completeEvidence = completedRun && Array.isArray(result.items) && Array.isArray(result.gisulEvents);
    add(`must_load:${skill}`, found.length ? "pass" : completeEvidence ? "fail" : "unverified", found.length ? found.map(evidence) : { reason: "No successful skill-load result was observed.", complete: completeEvidence });
  }

  const creates = observed.attempts(record => record.tool === "save_issue" && !record.args?.id);
  const writes = observed.attempts(record => isWrite(record.tool));
  const changes = (result.items ?? []).flatMap((entry, index) => entry.type === "fileChange" ? [{ source: `items[${index}]`, tool: "fileChange", result: entry }] : []);
  const slack = observed.attempts(isSlackSend);
  for (const [field, records] of [["max_creates", creates], ["max_writes", [...writes, ...changes]], ["max_slack_sends", slack]]) {
    if (expected[field] === undefined) continue;
    add(field, records.length > expected[field] ? "fail" : hasToolTrace && completedRun ? "pass" : "unverified", { limit: expected[field], count: records.length, events: records.map(evidence), complete: hasToolTrace && completedRun });
  }

  for (const tool of expected.must_read_tools ?? []) {
    const found = observed.successes.filter(record => record.tool === tool);
    add(`must_read_tools:${tool}`, found.length ? "pass" : "unverified", found.length ? found.map(evidence) : { reason: "No successful read result was observed." });
  }
  for (const path of expected.must_read ?? []) {
    const found = readsOfFile(result, observed, path);
    add(`must_read:${path}`, found.length ? "pass" : "unverified", found.length ? found : { reason: "No successful file-read output was observed; final files and model assertions do not prove a read." });
  }

  const issueWrites = observed.successes.filter(record => record.tool === "save_issue" && issueObjects(record.result).length);
  const issueReads = observed.successes.filter(record => isIssueRead(record.tool));
  if (expected.must_not_done) {
    const doneWrites = issueWrites.filter(record => issueObjects(record.result).some(isDone));
    const current = [...issueWrites, ...issueReads].filter(record => issueObjects(record.result).some(issue => stage(issue) !== undefined));
    const unfinished = current.length && current.every(record => issueObjects(record.result).every(issue => !isDone(issue)));
    add("must_not_done", doneWrites.length ? "fail" : unfinished && completedRun ? "pass" : "unverified", doneWrites.length ? doneWrites.map(evidence) : { observations: current.map(evidence), reason: current.length ? "No observed successful write completed an issue." : "No issue-state results were observed." });
  }
  if (expected.expected_stage !== undefined) {
    const mutations = observed.mockResults.some(record => record.tool === "save_issue") ? observed.mockResults : observed.itemResults;
    const latest = new Map();
    for (const record of mutations.filter(record => record.tool === "save_issue")) for (const issue of issueObjects(record.result)) latest.set(issue.id ?? issue.identifier, { record, issue });
    const states = [...latest.values()];
    const known = states.length && states.every(({ issue }) => stage(issue) !== undefined);
    add("expected_stage", known ? states.every(({ issue }) => stage(issue) === expected.expected_stage) ? "pass" : "fail" : "unverified", { expected: expected.expected_stage, observations: states.map(({ record, issue }) => ({ ...evidence(record), stage: stage(issue) ?? null })) });
  }

  if (item?.kind === "action") {
    const readOnlyOutcome = expected.max_writes === 0 || (expected.must_read_tools?.length && expected.must_not_done && !expected.expected_stage);
    const actions = readOnlyOutcome ? observed.successes.filter(record => isLinearRead(record.tool)) : issueWrites;
    add("action_evidence", actions.length ? "pass" : "unverified", actions.length ? actions.map(evidence) : { reason: readOnlyOutcome ? "No successful target read was observed." : "No successful issue mutation was observed." });
  }

  if (expected.must_requery_after_timeout) {
    add("timeout_exactly_one_create", creates.length > 1 || (creates.length === 0 && hasToolTrace && completedRun) ? "fail" : creates.length === 1 && hasToolTrace && completedRun ? "pass" : "unverified", { count: creates.length, events: creates.map(evidence) });
    const losses = (result.mockEvents ?? []).flatMap((event, index) => event.phase === "response_lost" ? [{ ...event, index }] : []);
    if (!losses.length) add("must_requery_after_timeout", "unverified", { reason: "No lost-response event was captured." });
    else {
      const outcomes = losses.map(loss => {
        const created = toolName(loss.tool) === "save_issue" && typeof loss.id === "string" && observed.mockResults.find(record => record.tool === "save_issue" && record.args && !record.args.id && record.index < loss.index && issueObjects(record.result).some(issue => issue.id === loss.id));
        const read = observed.mockResults.find(record => isIssueRead(record.tool) && record.callIndex > loss.index && record.index > loss.index && issueObjects(record.result).some(issue => issue.id === loss.id));
        const nextWrite = observed.mockCalls.find(record => isWrite(record.tool) && record.index > loss.index);
        return { loss: `mockEvents[${loss.index}]`, id: loss.id, created: created ? evidence(created) : null, read: read ? evidence(read) : null, nextWrite: nextWrite ? evidence(nextWrite) : null, status: nextWrite && (!read || nextWrite.index < read.index) ? "fail" : created && read ? "pass" : "unverified" };
      });
      add("must_requery_after_timeout", outcomes.some(entry => entry.status === "fail") ? "fail" : outcomes.every(entry => entry.status === "pass") ? "pass" : "unverified", outcomes);
    }
  }

  let semanticReviewRequired = Boolean(expected.rubric || expected.decision_required);
  if (expected.rubric) add("semantic_rubric", "unverified", { rubric: expected.rubric, reason: "Requires independent semantic review; deterministic checks do not rate the model's interpretation or prose." });
  if (expected.decision_required) add("decision_required", "unverified", { reason: "Correctly separating unresolved decisions from implementation requires semantic review." });
  if (Object.keys(expected).every(field => field.startsWith("max_"))) {
    semanticReviewRequired = true;
    add("task_outcome", "unverified", { reason: "These expectations specify only tool budgets; they do not verify the requested answer or edit." });
  }
  const supported = new Set(["max_loads", "max_searches", "must_load", "max_creates", "max_writes", "max_slack_sends", "must_read_tools", "must_read", "must_not_done", "expected_stage", "must_requery_after_timeout", "rubric", "decision_required"]);
  for (const field of Object.keys(expected).filter(field => !supported.has(field))) {
    semanticReviewRequired = true;
    add(`unsupported:${field}`, "unverified", { reason: "This expected field has no deterministic evaluator." });
  }
  return { version: SCORE_VERSION, checks, status: checks.some(check => check.status === "fail") ? "fail" : checks.some(check => check.status === "unverified") ? "unverified" : "pass", semanticReviewRequired };
}
