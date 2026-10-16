import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { prepareRuntime, runtimePin, selectTests } from "../scripts/verify.mjs";

const exec = promisify(execFile);
const repo = fileURLToPath(new URL("..", import.meta.url));

test("missing integration runtime explains how to prepare it before starting tests", async t => {
  const root = await mkdtemp(join(tmpdir(), "gisul-missing-runtime-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, "package.json"), await readFile(join(repo, "package.json")));
  await cp(join(repo, "scripts"), join(root, "scripts"), { recursive: true });
  await symlink(join(repo, "node_modules"), join(root, "node_modules"), "dir");
  await mkdir(join(root, "test"));
  await writeFile(join(root, "test/fixture.test.mjs"), 'import test from "node:test"; test("fixture", () => {});\n');
  const env = {
    ...process.env,
    GISUL_SERVER_PATH: join(root, "missing-server.js"),
    GISUL_WORKER_PATH: join(root, "missing-worker"),
  };
  delete env.NODE_TEST_CONTEXT;
  const result = await exec("npm", ["test"], { cwd: root, env, timeout: 10000 }).catch(error => error);
  assert.equal(result.code ?? 0, 1, "missing runtime must stop npm test before starting its suite");
  assert.match(result.stderr, /npm run verify/, "missing runtime needs an actionable preparation command");
  assert.doesNotMatch(result.stdout, /tests \d/, "preflight must fail before the suite starts");
});

test("unit and integration selections are disjoint and retain every test", () => {
  const files = ["verify.test.mjs", "candidate.test.mjs", "r2-publication.test.mjs", "quality.test.mjs", "release-bridge.test.mjs", "releases.test.mjs", "validation.test.mjs"];
  const unit = selectTests(files, "unit"), integration = selectTests(files, "integration");
  assert.deepEqual(unit, ["quality.test.mjs", "verify.test.mjs"]);
  assert.deepEqual([...unit, ...integration].sort(), files.sort());
  assert.equal(unit.filter(file => integration.includes(file)).length, 0);
});

test("preparation refuses foreign, dirty and differently pinned caches without changing them", async t => {
  const root = await mkdtemp(join(tmpdir(), "gisul-runtime-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cache = join(root, ".ci/gisul");
  await mkdir(cache, { recursive: true });
  await mkdir(join(root, ".github/workflows"), { recursive: true });
  const git = async args => (await exec("git", args, { cwd: cache, env: { ...process.env, GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid", GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" } })).stdout.trim();
  await git(["init", "-b", "main"]);
  await git(["-c", "core.hooksPath=/dev/null", "commit", "--allow-empty", "-m", "Fixture"]);
  const commit = await git(["rev-parse", "HEAD"]);
  const workflow = ref => `jobs:\n  validate:\n    steps:\n      - with:\n          repository: changeroa/gisul\n          ref: ${ref}\n          path: .ci/gisul\n`;
  await writeFile(join(root, ".github/workflows/validate.yml"), workflow(commit));
  assert.equal(await runtimePin(root), commit);
  await git(["remote", "add", "origin", "https://example.invalid/foreign.git"]);
  await assert.rejects(prepareRuntime(root), /unexpected origin/);
  await git(["remote", "set-url", "origin", "https://github.com/changeroa/gisul.git"]);
  await writeFile(join(cache, "uncommitted.txt"), "preserve this\n");
  await assert.rejects(prepareRuntime(root), /contains changes/);
  assert.equal(await readFile(join(cache, "uncommitted.txt"), "utf8"), "preserve this\n");
  await rm(join(cache, "uncommitted.txt"));
  const other = (commit[0] === "a" ? "b" : "a") + commit.slice(1);
  await writeFile(join(root, ".github/workflows/validate.yml"), workflow(other));
  await assert.rejects(prepareRuntime(root), /pinned revision/);
  assert.equal(await git(["rev-parse", "HEAD"]), commit);
  await writeFile(join(root, ".github/workflows/validate.yml"), workflow("main"));
  await assert.rejects(runtimePin(root), /full commit/);
});
