import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repo = fileURLToPath(new URL("..", import.meta.url));
const integration = new Set([
  "candidate.test.mjs",
  "r2-publication.test.mjs",
  "release-bridge.test.mjs",
  "releases.test.mjs",
  "validation.test.mjs",
]);
const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed in ${cwd}`);
}

export function selectTests(files, suite) {
  assert.ok(["unit", "integration"].includes(suite), "Unknown test suite");
  return files.filter(file => file.endsWith(".test.mjs") && integration.has(file) === (suite === "integration")).sort();
}

export async function runtimePin(root) {
  const workflow = parse(await readFile(join(root, ".github/workflows/validate.yml"), "utf8"));
  const checkouts = workflow.jobs.validate.steps.filter(step => step.with?.repository === "changeroa/gisul");
  assert.equal(checkouts.length, 1, "Expected one pinned changeroa/gisul checkout in validate.yml");
  assert.match(checkouts[0].with.ref, /^[a-f0-9]{40}$/, "Runtime checkout must pin a full commit");
  assert.equal(checkouts[0].with.path, ".ci/gisul", "Runtime checkout must use .ci/gisul");
  return checkouts[0].with.ref;
}

export async function requireRuntime(root, env = process.env) {
  let base = join(root, ".ci/gisul");
  try { await access(base); }
  catch (error) { if (error.code !== "ENOENT") throw error; base = resolve(root, "../gisul"); }
  const server = resolve(root, env.GISUL_SERVER_PATH ?? join(base, "server/dist/index.js"));
  const worker = resolve(root, env.GISUL_WORKER_PATH ?? join(base, "worker"));
  const missing = [];
  for (const path of [server, join(dirname(server), "codex.js"), join(worker, "package.json"), join(worker, "src/index.ts"), join(worker, "src/release-reader.ts")]) {
    try { assert.ok((await stat(path)).isFile()); } catch { missing.push(path); }
  }
  const require = createRequire(join(worker, "package.json"));
  for (const name of ["miniflare", "esbuild"]) {
    try { require.resolve(name); } catch { missing.push(`${worker}: dependency ${name}`); }
  }
  assert.equal(missing.length, 0, `Integration runtime is not ready:\n${missing.join("\n")}\nRun npm run verify to prepare the pinned runtime, or set GISUL_SERVER_PATH and GISUL_WORKER_PATH to a built checkout.`);
  return { ...env, GISUL_SERVER_PATH: server, GISUL_WORKER_PATH: worker };
}

export async function prepareRuntime(root) {
  const commit = await runtimePin(root), cache = join(root, ".ci/gisul");
  let present = true;
  try { assert.ok((await stat(cache)).isDirectory(), "Runtime cache must be a directory"); }
  catch (error) { if (error.code !== "ENOENT") throw error; present = false; }
  if (!present) {
    await mkdir(dirname(cache), { recursive: true });
    run("git", ["clone", "--filter=blob:none", "--no-checkout", "https://github.com/changeroa/gisul.git", cache], root);
    run("git", ["fetch", "origin", commit], cache);
    run("git", ["checkout", "--detach", commit], cache);
  }
  assert.equal(git(cache, ["remote", "get-url", "origin"]).replace(/\.git\/?$/, "").replace(/\/$/, ""), "https://github.com/changeroa/gisul", "Runtime cache has an unexpected origin; preserve it and choose a clean checkout");
  assert.equal(git(cache, ["rev-parse", "HEAD"]), commit, "Runtime cache differs from the pinned revision; preserve it and choose a clean checkout");
  assert.equal(git(cache, ["status", "--porcelain"]), "", "Runtime cache contains changes; preserve it and choose a clean checkout");
  // Use each package as cwd: --prefix through macOS /var aliases can change npm's lockfile resolution.
  run("npm", ["ci"], join(cache, "server"));
  run("npm", ["run", "build"], join(cache, "server"));
  run("npm", ["ci"], join(cache, "worker"));
  run("npm", ["run", "typecheck"], join(cache, "worker"));
  run("npx", ["playwright", "install", ...(process.platform === "linux" && process.env.CI ? ["--with-deps"] : []), "chromium"], root);
  const env = await requireRuntime(root, { ...process.env, GISUL_SERVER_PATH: join(cache, "server/dist/index.js"), GISUL_WORKER_PATH: join(cache, "worker") });
  return { commit, env };
}

async function main(mode) {
  assert.ok(Number(process.versions.node.split(".")[0]) >= 24, "Verification requires Node 24 or newer");
  if (mode === "check") { await requireRuntime(repo); return; }
  if (mode === "unit" || mode === "integration") {
    const env = mode === "integration" ? await requireRuntime(repo) : process.env;
    const files = selectTests(await readdir(join(repo, "test")), mode);
    assert.ok(files.length, "No tests selected");
    run(process.execPath, ["--test", ...files.map(file => join("test", file))], repo, env);
    return;
  }
  assert.equal(mode, "verify", "Usage: verify.mjs [verify|check|unit|integration]");
  const { commit, env } = await prepareRuntime(repo);
  run("npm", ["run", "validate"], repo, env);
  run("npm", ["test"], repo, env);
  const receipt = { passed: true, runtime_commit: commit, node: process.version, server: env.GISUL_SERVER_PATH, worker: env.GISUL_WORKER_PATH, catalog: "passed", tests: "passed" };
  await writeFile(join(repo, ".ci/verification.json"), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(process.argv[2] ?? "verify"); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
