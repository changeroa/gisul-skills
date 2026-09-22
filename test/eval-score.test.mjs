import { test } from "node:test";
import assert from "node:assert/strict";
import { dataset } from "../eval/dataset.mjs";
import { scoreCase, SCORE_VERSION } from "../eval/score.mjs";

const { cases } = await dataset();
const byId = id => cases.find(item => item.id === id);
const run = overrides => ({ status: "completed", finalText: "Done", usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 }, items: [], mockEvents: [], gisulEvents: [], files: {}, ...overrides });
const check = (score, name) => {
  const found = score.checks.find(entry => entry.name === name);
  assert.ok(found, `Missing check ${name}`);
  return found;
};
const call = (tool, args = {}) => ({ phase: "call", tool, args });
const applied = (tool, result) => ({ phase: "applied", tool, result });
const issue = (status = "진행 중", id = "IYEN-301") => ({ id, status, statusType: status === "완료" ? "completed" : "started" });
const mcp = (tool, args, result, extra = {}) => ({ type: "mcpToolCall", server: "gisul", tool, arguments: args, status: "completed", result: { content: [{ type: "text", text: JSON.stringify(result) }] }, ...extra });
const command = (command, aggregatedOutput, extra = {}) => ({ type: "commandExecution", status: "completed", exitCode: 0, command, aggregatedOutput, ...extra });

test("semantic rubrics remain unverified after all observable checks pass", () => {
  const score = scoreCase(byId("L-06"), run({ mockEvents: [call("save_issue", { id: "IYEN-601", state: "완료" }), applied("save_issue", issue("완료", "IYEN-601"))] }));
  assert.equal(score.version, SCORE_VERSION);
  assert.equal(score.status, "unverified");
  assert.equal(score.semanticReviewRequired, true);
  assert.equal(check(score, "action_evidence").status, "pass");
  assert.equal(check(score, "max_slack_sends").status, "pass");
  assert.equal(check(score, "semantic_rubric").status, "unverified");
  assert.equal(Object.hasOwn(score, "humanRating"), false);
});

test("all action cases stay unverified or fail with empty tool evidence", () => {
  for (const item of cases.filter(item => item.kind === "action")) {
    const score = scoreCase(item, run({ finalText: "I read everything, updated the correct issue, verified it, and sent no Slack." }));
    assert.notEqual(score.status, "pass", item.id);
    assert.equal(check(score, "action_evidence").status, "unverified", item.id);
  }
});

test("execution failures and missing usage stay visible even when budgets pass", () => {
  const failed = scoreCase(byId("N-01"), run({ status: "failed", failure: { type: "infrastructure", message: "Not connected" }, usage: null }));
  assert.equal(failed.status, "fail");
  assert.equal(check(failed, "execution").evidence.failure.message, "Not connected");
  assert.equal(check(failed, "usage").status, "unverified");
  assert.equal(check(failed, "max_searches").status, "unverified");
  for (const usage of [undefined, null, {}, { totalTokens: NaN }, { totalTokens: -1 }]) {
    const score = scoreCase(byId("N-01"), run({ usage }));
    assert.equal(score.status, "unverified");
    assert.equal(check(score, "usage").status, "unverified");
  }
  for (const status of ["timeout", "timed_out", "interrupted", "cancelled"]) assert.equal(scoreCase(byId("N-01"), run({ status })).status, "fail");
});

test("missing capture is not a passing absence check", () => {
  const score = scoreCase(byId("N-01"), { status: "completed", usage: { totalTokens: 1 } });
  assert.equal(check(score, "max_loads").status, "unverified");
  assert.equal(check(score, "max_searches").status, "unverified");
});

test("GISUL search side-log alias and failed attempts count against budgets", () => {
  for (const event of [{ event: "search", query: "티켓" }, { event: "error", operation: "search", code: "not_connected" }]) {
    const score = scoreCase(byId("N-01"), run({ gisulEvents: [event] }));
    assert.equal(check(score, "max_searches").status, "fail");
    assert.equal(check(score, "max_searches").evidence.count, 1);
  }
  const score = scoreCase(byId("S-01"), run({ gisulEvents: [1, 2, 3].map(() => ({ event: "error", operation: "load_skill", code: "not_connected" })) }));
  assert.equal(check(score, "max_loads").status, "fail");
  assert.equal(check(score, "must_load:linear-delivery").status, "fail");
});

test("required loads require actual successful results and distinguish missing capture", () => {
  const uri = "skill://gisul/gisul/linear-delivery/SKILL.md";
  const full = scoreCase(byId("S-01"), run({ finalText: "I loaded linear-delivery", files: { "SKILL.md": "linear-delivery" } }));
  assert.equal(check(full, "must_load:linear-delivery").status, "fail");
  const missing = scoreCase(byId("S-01"), { status: "completed", usage: { totalTokens: 1 } });
  assert.equal(check(missing, "must_load:linear-delivery").status, "unverified");
  const attempted = scoreCase(byId("S-01"), run({ items: [mcp("load_skill", { uri }, { error: "Not connected" }, { status: "failed", error: "Not connected" })] }));
  assert.equal(check(attempted, "must_load:linear-delivery").status, "fail");
  const observed = scoreCase(byId("S-01"), run({ gisulEvents: [{ event: "load_skill", uri, release: "fixture" }] }));
  assert.equal(check(observed, "must_load:linear-delivery").status, "pass");
  const toolResult = scoreCase(byId("S-01"), run({ items: [mcp("mcp__gisul__load_skill", { uri }, { uri, markdown: "Loaded body" })] }));
  assert.equal(check(toolResult, "must_load:linear-delivery").status, "pass");
  const emptyResult = scoreCase(byId("S-01"), run({ items: [mcp("load_skill", { uri }, {})] }));
  assert.equal(check(emptyResult, "must_load:linear-delivery").status, "fail");
});

test("GISUL side logs and app-server copies do not double-count a load", () => {
  const uri = "skill://gisul/gisul/linear-delivery/SKILL.md";
  const score = scoreCase({ expected: { max_loads: 1 } }, run({ gisulEvents: [{ event: "load_skill", uri }], items: [mcp("load_skill", { uri }, { uri })] }));
  assert.equal(check(score, "max_loads").evidence.count, 1);
  assert.equal(check(score, "max_loads").status, "pass");
});

test("create and write limits use calls; a failed or duplicate create is still an attempt", () => {
  const score = scoreCase(byId("L-02"), run({ mockEvents: [call("save_issue", { title: "duplicate" })] }));
  assert.equal(check(score, "max_creates").status, "fail");
  assert.equal(check(score, "action_evidence").status, "unverified");
  const mismatch = scoreCase(byId("L-07"), run({ mockEvents: [call("save_issue", { id: "OTHER-1", state: "완료" }), applied("save_issue", { error: "wrong target" })] }));
  assert.equal(check(mismatch, "max_writes").status, "fail");
  const changed = scoreCase(byId("L-07"), run({ items: [{ type: "fileChange", status: "completed", changes: [{ path: "workspace/api.js" }] }] }));
  assert.equal(check(changed, "max_writes").status, "fail");
});

test("manual Slack attempts are visible in the mock and connector result surfaces", () => {
  const mock = scoreCase(byId("L-06"), run({ mockEvents: [call("send_slack_message", { channel: "fixture", text: "Done" }), applied("send_slack_message", { sent: false, fixture: true })] }));
  assert.equal(check(mock, "max_slack_sends").status, "fail");
  const connector = scoreCase(byId("L-06"), run({ items: [mcp("mcp__codex_apps__slack_slack_send_message", { channel: "fixture" }, { ok: true })] }));
  assert.equal(check(connector, "max_slack_sends").status, "fail");
});

test("must_read_tools requires a result, not a requested call or claimed comment review", () => {
  const missing = scoreCase(byId("L-05"), run({ finalText: "Read latest comments", mockEvents: [call("list_comments", { issueId: "IYEN-501" })] }));
  assert.equal(check(missing, "must_read_tools:list_comments").status, "unverified");
  const present = scoreCase(byId("L-05"), run({ mockEvents: [call("list_comments", { issueId: "IYEN-501" }), applied("list_comments", [{ body: "new condition" }])] }));
  assert.equal(check(present, "must_read_tools:list_comments").status, "pass");
  assert.equal(present.status, "unverified");
});

test("must_read accepts successful read output and rejects assertions, filenames, snapshots and failures", () => {
  const item = byId("F-01");
  const output = "export function upload({ path }) { return { image_ref: path }; }";
  for (const entry of [command("cat workspace/api.js", output), command("/bin/zsh -lc 'cat workspace/api.js'", output), command("sed -n '1,80p' workspace/api.js", output), command("cat 'workspace/api.js'", output)]) {
    assert.equal(check(scoreCase(item, run({ items: [entry] })), "must_read:api.js").status, "pass");
  }
  for (const entry of [command("cat workspace/api.js", "not found", { exitCode: 1 }), command("cat workspace/api.js", ""), command("echo 'cat workspace/api.js'", "cat workspace/api.js"), command("ls workspace/api.js", "workspace/api.js"), { type: "agentMessage", text: output }]) {
    assert.equal(check(scoreCase(item, run({ items: [entry], finalText: "I read api.js", files: { "workspace/api.js": output } })), "must_read:api.js").status, "unverified");
  }
});

test("must_not_done rejects applied completed state and ignores a claimed state in prose", () => {
  const saved = scoreCase(byId("L-03"), run({ mockEvents: [call("save_issue", { id: "IYEN-301", state: "완료" }), applied("save_issue", issue("완료"))] }));
  assert.equal(check(saved, "must_not_done").status, "fail");
  assert.equal(check(saved, "expected_stage").status, "fail");
  const claimed = scoreCase(byId("L-03"), run({ finalText: "Set 검증·배포 대기, never Done." }));
  assert.equal(check(claimed, "expected_stage").status, "unverified");
  assert.equal(check(claimed, "must_not_done").status, "unverified");
});

test("expected_stage requires applied mutations and checks the last saved state", () => {
  const good = [call("save_issue", { id: "IYEN-301", state: "검증·배포 대기" }), applied("save_issue", issue("검증·배포 대기"))];
  assert.equal(scoreCase(byId("L-03"), run({ mockEvents: good })).status, "pass");
  const failed = [...good, call("save_issue", { id: "IYEN-301", state: "진행 중" }), applied("save_issue", issue("진행 중"))];
  assert.equal(check(scoreCase(byId("L-03"), run({ mockEvents: failed })), "expected_stage").status, "fail");
  const readOnly = [call("get_issue", { id: "IYEN-301" }), applied("get_issue", issue("검증·배포 대기"))];
  assert.equal(check(scoreCase(byId("L-03"), run({ mockEvents: readOnly })), "expected_stage").status, "unverified");
});

function timeoutEvents() {
  return [call("save_issue", { title: "[L-08] 회복 검증" }), applied("save_issue", issue("착수 가능", "EVAL-1")), { phase: "response_lost", tool: "save_issue", id: "EVAL-1" }];
}
const requery = [call("list_issues", { query: "[L-08] 회복 검증" }), applied("list_issues", { issues: [issue("착수 가능", "EVAL-1")] })];
const update = [call("save_issue", { id: "EVAL-1", description: "Updated" }), applied("save_issue", issue("착수 가능", "EVAL-1"))];

test("timeout recovery requires one create and a matching read after loss before the next write", () => {
  const recovered = scoreCase(byId("L-08"), run({ mockEvents: [...timeoutEvents(), ...requery, ...update] }));
  assert.equal(recovered.status, "pass");
  assert.equal(check(recovered, "timeout_exactly_one_create").status, "pass");
  assert.equal(check(recovered, "must_requery_after_timeout").status, "pass");
  const noFurtherWrite = scoreCase(byId("L-08"), run({ mockEvents: [...timeoutEvents(), ...requery] }));
  assert.equal(noFurtherWrite.status, "pass");
});

test("timeout recovery cannot use an earlier read, a later read after another write, or a wrong target", () => {
  const outOfOrder = scoreCase(byId("L-08"), run({ mockEvents: [...timeoutEvents(), ...update, ...requery] }));
  assert.equal(check(outOfOrder, "must_requery_after_timeout").status, "fail");
  const earlier = scoreCase(byId("L-08"), run({ mockEvents: [...requery, ...timeoutEvents(), ...update] }));
  assert.equal(check(earlier, "must_requery_after_timeout").status, "fail");
  const wrong = scoreCase(byId("L-08"), run({ mockEvents: [...timeoutEvents(), call("get_issue", { id: "OTHER-1" }), applied("get_issue", issue("착수 가능", "OTHER-1"))] }));
  assert.equal(check(wrong, "must_requery_after_timeout").status, "unverified");
  const pendingRead = scoreCase(byId("L-08"), run({ mockEvents: [...timeoutEvents(), requery[0], ...update, requery[1]] }));
  assert.equal(check(pendingRead, "must_requery_after_timeout").status, "fail");
  const startedBeforeLoss = scoreCase(byId("L-08"), run({ mockEvents: [requery[0], ...timeoutEvents(), requery[1]] }));
  assert.equal(check(startedBeforeLoss, "must_requery_after_timeout").status, "unverified");
});

test("timeout recovery has no vacuous pass for zero creates, repeats or absent loss evidence", () => {
  const none = scoreCase(byId("L-08"), run());
  assert.notEqual(check(none, "timeout_exactly_one_create").status, "pass");
  assert.notEqual(check(none, "must_requery_after_timeout").status, "pass");
  const repeated = scoreCase(byId("L-08"), run({ mockEvents: [...timeoutEvents(), ...requery, call("save_issue", { title: "retry" }), applied("save_issue", issue("착수 가능", "EVAL-2"))] }));
  assert.equal(check(repeated, "timeout_exactly_one_create").status, "fail");
  const noLoss = scoreCase(byId("L-08"), run({ mockEvents: [call("save_issue", { title: "test" }), applied("save_issue", issue("着手", "EVAL-1")), ...requery] }));
  assert.equal(check(noLoss, "must_requery_after_timeout").status, "unverified");
});

test("unsupported expected fields and decision separation stay explicitly unverified", () => {
  const unsupported = scoreCase({ expected: { custom_semantics: true } }, run());
  assert.equal(unsupported.status, "unverified");
  assert.equal(unsupported.semanticReviewRequired, true);
  assert.equal(check(unsupported, "unsupported:custom_semantics").status, "unverified");
  const decision = scoreCase(byId("L-01"), run({ mockEvents: [call("save_issue", { title: "decision" }), applied("save_issue", issue())] }));
  assert.equal(check(decision, "decision_required").status, "unverified");
});

test("budget-only cases do not claim successful answers or file edits", () => {
  for (const id of ["N-01", "N-03", "N-04", "S-08"]) {
    const score = scoreCase(byId(id), run({ finalText: "Everything has been changed correctly." }));
    assert.equal(check(score, "task_outcome").status, "unverified");
    assert.equal(score.status, "unverified");
    assert.equal(score.semanticReviewRequired, true);
  }
});
