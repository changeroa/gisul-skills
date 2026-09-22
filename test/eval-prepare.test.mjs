import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { dataset } from "../eval/dataset.mjs";
import { prepareCase } from "../eval/prepare.mjs";
import { mockLinear } from "../eval/mock-linear.mjs";

const exec = promisify(execFile);
const { cases } = await dataset();
const byId = id => cases.find(item => item.id === id);
async function directories(t) {
  const root = await mkdtemp(join(tmpdir(), "gisul-prepare-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, workspace: join(root, "task"), privateDir: join(root, "private") };
}
async function fixtureClient(t, fixture, options = {}) {
  const client = new Client({ name: "prepare-test", version: "1" });
  const { server } = mockLinear({ fixture, ...options });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  t.after(async () => { await client.close(); await server.close(); });
  return { client, call: async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse(result.content[0].text);
  } };
}

test("all 22 frozen inputs prepare without exposing case labels or other scenarios", async t => {
  const paths = await directories(t);
  const scenarios = JSON.parse(await readFile(new URL("../eval/fixtures/scenarios.json", import.meta.url), "utf8"));
  for (const item of cases) {
    const workspace = join(paths.root, item.id, "task"), privateDir = join(paths.root, item.id, "private");
    const prepared = await prepareCase({ item, workspace, privateDir });
    assert.equal(prepared.prompt, item.input.prompt);
    assert.deepEqual(JSON.parse(await readFile(join(workspace, "scenario.json"), "utf8")), scenarios[item.input.scenario] ?? {});
    assert.deepEqual(prepared.inputFiles, ["scenario.json", "workspace/api-intro.md", "workspace/api.js", "workspace/hello.js", "workspace/hooks.json", "workspace/settings.json"]);
    assert.deepEqual((await readdir(workspace)).sort(), [".git", "scenario.json", "workspace"]);
    assert.ok(relative(await realpath(workspace), prepared.linearFixture).startsWith(".."));
    assert.equal((await stat(prepared.linearFixture)).mode & 0o777, 0o600);
    assert.equal(prepared.timeoutOnce, item.id === "L-08");
    assert.equal(prepared.offlineGisul, item.id === "S-10");
    assert.equal(prepared.limitations.length, item.id === "F-02" ? 1 : 0);
    assert.doesNotMatch(await readFile(join(workspace, "scenario.json"), "utf8"), /"(?:expected|rubric|split|caseid|case_id|answers)"/i);
    const git = await exec("git", ["rev-parse", "--show-toplevel"], { cwd: workspace });
    assert.equal(git.stdout.trim(), await realpath(workspace));
    assert.equal(await readFile(join(workspace, "workspace/api.js"), "utf8"), await readFile(new URL("../eval/fixtures/workspace/api.js", import.meta.url), "utf8"));
  }
});

test("case fixture allowlist is respected and prompt is never amended", async t => {
  const paths = await directories(t);
  const item = { ...byId("F-01"), input: { prompt: "unaltered\nuser prompt", fixtures: ["fixtures/workspace/api.js"] } };
  const prepared = await prepareCase({ item, ...paths });
  assert.equal(prepared.prompt, item.input.prompt);
  assert.deepEqual(prepared.inputFiles, ["scenario.json", "workspace/api.js"]);
  assert.deepEqual(await readdir(join(paths.workspace, "workspace")), ["api.js"]);
  assert.deepEqual(JSON.parse(await readFile(prepared.linearFixture, "utf8")).issues, []);
});

test("private data cannot enter the workspace through a direct path or symlink", async t => {
  const paths = await directories(t);
  await assert.rejects(prepareCase({ item: byId("F-01"), ...paths, privateDir: join(paths.workspace, "private") }), /outside/);
  await mkdir(paths.workspace, { recursive: true });
  await symlink(paths.workspace, paths.privateDir);
  await assert.rejects(prepareCase({ item: byId("F-01"), ...paths }), /including symlinks/);
});

test("nonempty workspaces and unsafe or unsupported inputs fail before copying", async t => {
  const paths = await directories(t);
  await mkdir(paths.workspace);
  await writeFile(join(paths.workspace, "owned.txt"), "preserve");
  await assert.rejects(prepareCase({ item: byId("F-01"), ...paths }), /empty/);
  assert.equal(await readFile(join(paths.workspace, "owned.txt"), "utf8"), "preserve");
  for (const fixture of ["../cases/F-01.yaml", "fixtures/../cases/F-01.yaml", "fixtures/scenarios.json/extra", "fixtures/unknown.json"]) {
    await assert.rejects(prepareCase({ ...paths, item: { input: { prompt: "same", fixtures: [fixture] } } }), /fixture/i);
  }
});

test("L-03 exposes implementation/deployment facts and unverified flows through Linear tools", async t => {
  const prepared = await prepareCase({ item: byId("L-03"), ...await directories(t) });
  const { call } = await fixtureClient(t, JSON.parse(await readFile(prepared.linearFixture, "utf8")));
  const target = (await call("list_issues", { project: "dev-tools" })).issues[0];
  assert.notEqual(target.id, "IYEN-31");
  assert.equal(target.deployed, true);
  assert.equal(target.implementation, true);
  assert.deepEqual(target.verified_flows, []);
  assert.deepEqual(target.required_flows, ["실사용 흐름"]);
  assert.notEqual(target.statusType, "completed");
  const saved = await call("save_issue", { id: target.id, state: "검증·배포 대기" });
  assert.equal(saved.status, "검증·배포 대기");
});

test("L-04 supplies distinct decision, development and parent issues", async t => {
  const prepared = await prepareCase({ item: byId("L-04"), ...await directories(t) });
  const { call } = await fixtureClient(t, JSON.parse(await readFile(prepared.linearFixture, "utf8")));
  const issues = (await call("list_issues", { project: "dev-tools" })).issues;
  assert.equal(issues.length, 3);
  const decision = issues.find(issue => issue.kind === "decision"), development = issues.find(issue => issue.kind === "development"), parent = issues.find(issue => issue.kind === "delivery");
  assert.equal(decision.decision_complete, true);
  assert.equal(decision.parentId, parent.id);
  assert.equal(development.parentId, parent.id);
  assert.equal(decision.relations.relatedTo[0].id, development.id);
  await call("save_issue", { id: decision.id, state: "완료" });
  assert.equal((await call("get_issue", { id: decision.id })).statusType, "completed");
  assert.notEqual((await call("get_issue", { id: development.id })).statusType, "completed");
  assert.notEqual((await call("get_issue", { id: parent.id })).statusType, "completed");
});

test("L-05 supplies the selected comment and L-06 verified acceptance plus automatic notifications", async t => {
  const paths = await directories(t);
  for (const id of ["L-05", "L-06"]) {
    const prepared = await prepareCase({ item: byId(id), workspace: join(paths.root, id, "task"), privateDir: join(paths.root, id, "private") });
    const { call } = await fixtureClient(t, JSON.parse(await readFile(prepared.linearFixture, "utf8")));
    const target = (await call("list_issues", { project: "dev-tools" })).issues[0];
    if (id === "L-05") {
      assert.equal(target.mobile_resume_verified, false);
      const comments = await call("list_comments", { issueId: target.id });
      assert.equal(comments.length, 1);
      assert.equal(comments[0].body, "확정: 모바일 복귀 시 상태도 유지해야 함");
    } else {
      assert.equal(target.acceptance_complete, true);
      assert.equal(target.deployed, true);
      assert.equal(target.user_flow_verified, true);
      assert.equal(target.automatic_notifications, true);
      assert.equal((await call("get_project", { query: "dev-tools" })).automatic_notifications, true);
    }
  }
});

test("L-07 exposes actual foreign identity and the linked OTHER-1 target", async t => {
  const prepared = await prepareCase({ item: byId("L-07"), ...await directories(t) });
  const { call } = await fixtureClient(t, JSON.parse(await readFile(prepared.linearFixture, "utf8")));
  assert.deepEqual(await call("get_workspace"), { id: "fixture-foreign", name: "Foreign" });
  const project = await call("get_project", { query: "dev-tools" }), target = await call("get_issue", { id: "OTHER-1" });
  assert.equal(project.id, "fixture-foreign-project");
  assert.equal(target.projectId, project.id);
  assert.equal(target.workspaceId, "fixture-foreign");
  assert.equal(target.url, "https://linear.invalid/foreign/issue/OTHER-1");
});

test("L-08 adapter flag injects successful create with lost response in the existing mock", async t => {
  const prepared = await prepareCase({ item: byId("L-08"), ...await directories(t) });
  const events = [], fixture = JSON.parse(await readFile(prepared.linearFixture, "utf8"));
  const { client, call } = await fixtureClient(t, fixture, { timeoutOnce: prepared.timeoutOnce, record: async event => events.push(structuredClone(event)) });
  await assert.rejects(client.callTool({ name: "save_issue", arguments: { title: "[L-08] 회복 검증", project: "dev-tools", team: "IYEN Development", template: "개발 작업" } }, undefined, { timeout: 50 }), /timed out/i);
  assert.equal((await call("list_issues", { query: "[L-08] 회복 검증" })).issues.length, 1);
  assert.equal(events.filter(event => event.phase === "response_lost").length, 1);
});
