import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdtemp, stat, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const repo = fileURLToPath(new URL("..", import.meta.url));
const skill = join(repo, "skills/archify");

async function packageCopy(t) {
  const root = await mkdtemp(join(tmpdir(), "archify-isolated-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const copy = join(root, "archify");
  await cp(skill, copy, { recursive: true, filter: path => basename(path) !== "node_modules" });
  return copy;
}

test("the packaged Archify verification command validates and renders every diagram type", { timeout: 60000 }, async () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = await exec("npm", ["run", "verify:archify"], { cwd: repo, env, timeout: 50000 }).catch(error => error);
  assert.equal(result.code ?? 0, 0, "the packaged verification entrypoint must run successfully");
  const receipt = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
  assert.equal(receipt.passed, true);
  assert.deepEqual(receipt.diagrams.map(item => item.type), ["architecture", "workflow", "sequence", "dataflow", "lifecycle"]);
  assert.ok(receipt.diagrams.every(item => item.artifact_checks >= 9 && item.bytes > 0));
  assert.equal(receipt.malformed_rejected, true);
  assert.equal(receipt.cleanup.removed, true);
  await assert.rejects(stat(receipt.cleanup.directory), { code: "ENOENT" });
});

test("a copied package verifies without node_modules or upstream parent tools", { timeout: 60000 }, async t => {
  const copy = await packageCopy(t), env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  delete env.NODE_PATH;
  await assert.rejects(stat(join(copy, "node_modules")), { code: "ENOENT" });
  const { stdout } = await exec(process.execPath, [join(copy, "scripts/verify.mjs")], { cwd: copy, env, timeout: 50000 });
  const receipt = JSON.parse(stdout);
  assert.equal(receipt.passed, true);
  assert.equal(receipt.diagrams.length, 5);
  assert.ok(receipt.diagrams.every(item => /^[a-f0-9]{64}$/.test(item.sha256)));
  await assert.rejects(stat(receipt.cleanup.directory), { code: "ENOENT" });
});

test("a malformed shipped example fails verification and still removes temporary output", { timeout: 60000 }, async t => {
  const copy = await packageCopy(t);
  await writeFile(join(copy, "examples/web-app.architecture.json"), "{}\n");
  const result = await exec(process.execPath, [join(copy, "scripts/verify.mjs")], { cwd: copy, timeout: 50000 }).catch(error => error);
  assert.equal(result.code, 1);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.passed, false);
  assert.equal(receipt.type, "architecture");
  assert.equal(receipt.stage, "validate");
  assert.equal(receipt.cleanup.removed, true);
  await assert.rejects(stat(receipt.cleanup.directory), { code: "ENOENT" });
});
