import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { smokeR2 } from "../scripts/r2-smoke.mjs";
import { startCanaryServer } from "./fixtures/production-canary.mjs";

async function fixture(t, options) {
  const server = await startCanaryServer(options);
  t.after(() => server.close());
  return server;
}

test("read-only MCP smoke checks actual catalog and resource bytes over HTTP", async t => {
  const server = await fixture(t);
  const result = await smokeR2(server.base, server.token, server.expected, { manifest: server.manifest });
  assert.equal(result.commit, server.expected.commit);
  assert.equal(result.reads.length, 2);
  const initialized = server.exchanges.find(item => item.rpcMethod === "initialize");
  assert.equal(initialized.status, 200);
  assert.equal(initialized.headers["content-type"], "application/json");
  assert.equal(initialized.body.result.serverInfo.version, "runtime-test-2");
  assert.ok(server.exchanges.some(item => item.rpcMethod === "resources/read" && item.status === 200));
  assert.equal(server.mutations, 0);
});

test("read-only MCP smoke refuses the wrong bearer without administrative calls", async t => {
  const server = await fixture(t);
  await assert.rejects(smokeR2(server.base, "wrong", server.expected, { manifest: server.manifest }));
  assert.ok(server.exchanges.some(item => item.status === 401));
  assert.equal(server.mutations, 0);
});

test("read-only MCP smoke refuses corrupt bytes even when their length is unchanged", async t => {
  const server = await fixture(t, { corrupt: true });
  await assert.rejects(smokeR2(server.base, server.token, server.expected, { manifest: server.manifest }));
  assert.ok(server.exchanges.some(item => item.rpcMethod === "resources/read" && item.status === 200));
  assert.equal(server.mutations, 0);
});

test("read-only MCP smoke rejects stale runtime identity before accepting content", async t => {
  const server = await fixture(t, { version: "runtime-test-1" });
  await assert.rejects(smokeR2(server.base, server.token, server.expected, {
    manifest: server.manifest, runtimeVersion: server.expected.runtimeVersion,
  }), { code: "MCP_RUNTIME_MISMATCH" });
  assert.equal(server.mutations, 0);
});

async function canaryCLI(t, server, overrides = {}) {
  const out = await mkdtemp(join(tmpdir(), "production-canary-cli-"));
  t.after(() => rm(out, { recursive: true, force: true }));
  const receipt = join(out, "receipt.json");
  const env = Object.fromEntries(["PATH", "HOME", "USER", "TMPDIR", "LANG"].filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  Object.assign(env, {
    GISUL_RELEASE_BASE_URL: server.base, GISUL_BEARER_TOKEN: server.token,
    GISUL_CANARY_EXPECTED: JSON.stringify(server.expected),
  }, overrides);
  const result = await new Promise(resolve => {
    execFile("npm", ["run", "--silent", "canary:production", "--", "--out", receipt],
      { cwd: fileURLToPath(new URL("..", import.meta.url)), env, timeout: 15000 }, (error, stdout, stderr) => {
        resolve({ status: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr });
      });
  });
  return { ...result, receipt };
}

test("scheduled canary CLI retains a verified redacted receipt from actual HTTP", async t => {
  const server = await fixture(t);
  const result = await canaryCLI(t, server);
  assert.equal(result.status, 0, result.stderr);
  const bytes = await readFile(result.receipt, "utf8"), receipt = JSON.parse(bytes);
  assert.equal(receipt.passed, true);
  assert.equal(receipt.phase, "complete");
  assert.equal(receipt.smoke.server.version, server.expected.runtimeVersion);
  assert.equal(receipt.smoke.commit, server.expected.commit);
  assert.equal(receipt.smoke.reads.length, 2);
  assert.equal(bytes.includes(server.token), false);
  assert.equal(server.exchanges.find(item => item.path === "/inventory.json").authorized, false);
  assert.equal(server.mutations, 0);
});

test("scheduled canary retains configuration failure without a network call", async t => {
  const server = await fixture(t);
  const result = await canaryCLI(t, server, { GISUL_CANARY_EXPECTED: "" });
  assert.equal(result.status, 1);
  const receipt = JSON.parse(await readFile(result.receipt));
  assert.equal(receipt.passed, false);
  assert.equal(receipt.phase, "preflight");
  assert.equal(receipt.error.code, "CANARY_CONFIG_INVALID");
  assert.deepEqual(server.exchanges, []);
});

test("scheduled canary refuses stale runtime, bad auth, resource corruption and untrusted inventory", async t => {
  for (const [name, options, env, phase] of [
    ["runtime", { version: "private-canary-fixture-token" }, {}, "mcp"],
    ["auth", {}, { GISUL_BEARER_TOKEN: "wrong-private-token" }, "mcp"],
    ["resource", { corrupt: true }, {}, "mcp"],
    ["inventory", { corruptInventory: true }, {}, "manifest"],
  ]) {
    await t.test(name, async sub => {
      const server = await fixture(sub, options);
      const result = await canaryCLI(sub, server, env);
      assert.equal(result.status, 1);
      const bytes = await readFile(result.receipt, "utf8"), receipt = JSON.parse(bytes);
      assert.equal(receipt.passed, false);
      assert.equal(receipt.phase, phase);
      assert.equal(bytes.includes(server.token), false);
      assert.equal(bytes.includes("wrong-private-token"), false);
      assert.equal((bytes + result.stdout + result.stderr).includes(server.token), false);
      assert.equal((bytes + result.stdout + result.stderr).includes("wrong-private-token"), false);
      if (name === "inventory") assert.equal(server.exchanges.some(item => item.rpcMethod === "initialize"), false);
      assert.equal(server.mutations, 0);
    });
  }
});

test("scheduled canary workflow permits only read operations and always retains evidence", async () => {
  const workflow = parse(await readFile(new URL("../.github/workflows/production-canary.yml", import.meta.url), "utf8"));
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.ok(workflow.on.schedule.length > 0 && workflow.on.schedule.every(item => typeof item.cron === "string"));
  assert.ok(Object.hasOwn(workflow.on, "workflow_dispatch"));
  const steps = workflow.jobs.canary.steps;
  assert.deepEqual(steps.filter(step => step.run).map(step => step.run), ["npm ci", "npm run canary:production"]);
  assert.equal(steps.some(step => Object.hasOwn(step.env ?? {}, "GISUL_PUBLISH_TOKEN")), false);
  const retention = steps.find(step => step.with?.path === "dist/receipts/production-canary.json");
  assert.equal(retention.if, "always()");
  assert.equal(retention.with["if-no-files-found"], "error");
});
