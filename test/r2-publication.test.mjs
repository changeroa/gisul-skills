import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildR2Release, verifyR2Release } from "../scripts/build-r2-release.mjs";
import { verifyRelease } from "../scripts/release-files.mjs";
import { git, requireGitContentParity, requireLatestMain, requirePublicationGate } from "../scripts/publication-gate.mjs";
import { activateVerified, releaseApi, uploadArtifact } from "../scripts/r2-publisher.mjs";
import { smokeR2 } from "../scripts/r2-smoke.mjs";

const worker = process.env.GISUL_WORKER_PATH ?? fileURLToPath(new URL("../../gisul/worker", import.meta.url));
const require = createRequire(join(worker, "package.json"));
const { Miniflare } = require("miniflare");
const { build } = require("esbuild");
const { parseInventory } = await import(pathToFileURL(join(worker, "src/release-reader.ts")));
const bundle = build({ entryPoints: [join(worker, "src/index.ts")], bundle: true, write: false, format: "esm", platform: "browser", target: "es2022", external: ["cloudflare:workers"] });

async function fixture(t) {
  const repo = await mkdtemp(join(tmpdir(), "gisul-r2-publication-"));
  t.after(() => rm(repo, { recursive: true, force: true }));
  await mkdir(join(repo, "skills/demo/references"), { recursive: true });
  await writeFile(join(repo, ".gitignore"), "dist/\n");
  await writeFile(join(repo, "skills/demo/notes.txt"), "An inventoried supporting file\n");
  await writeFile(join(repo, "skills/demo/SKILL.md"), "---\nname: demo\ndescription: Demo 데모\nmetadata:\n  nested: [one, two]\n---\nUse references/guide.md only when needed.\n");
  await writeFile(join(repo, "skills/demo/references/guide.md"), "An independently checked supporting file.\n");
  await writeFile(join(repo, "aliases.json"), JSON.stringify({ "skill://gisul/codex/demo/SKILL.md": "skill://gisul/gisul/demo/SKILL.md" }));
  git(repo, ["init", "-b", "main"]);
  git(repo, ["config", "user.name", "Fixture"]);
  git(repo, ["config", "user.email", "fixture@example.invalid"]);
  git(repo, ["add", "."]); git(repo, ["commit", "-m", "Accepted skill content"]);
  return repo;
}

test("R2 adaptation preserves the existing builder inventory and verifies with the serving contract", async t => {
  const repo = await fixture(t);
  const output = await buildR2Release(repo, "20260917.4");
  const identity = await verifyR2Release(output);
  assert.equal((await requireGitContentParity(repo, identity.commit, output)).exact_git_bytes, true);
  const source = join(repo, "dist/20260917.4");
  assert.equal((await verifyRelease(source)).commit, identity.commit, "the original builder output remains valid");
  assert.deepEqual(await readFile(join(output, "build-inventory.json")), await readFile(join(source, "inventory.json")));
  const snapshot = parseInventory(await readFile(join(output, "inventory.json"), "utf8"), identity);
  assert.equal(snapshot.inventory.skills.length, 1);
  assert.equal(snapshot.inventory.skills[0].frontmatter.metadata.nested[1], "two");
  for (const file of snapshot.inventory.files.filter(file => file.uri)) assert.deepEqual(await readFile(join(output, file.path)), await readFile(join(source, file.path)));
  assert.equal(await buildR2Release(repo, "20260917.4"), output);
  await writeFile(join(output, "skills/demo/references/guide.md"), "Changed after verification");
  await assert.rejects(verifyR2Release(output), /inventory mismatch/);
  await assert.rejects(requireGitContentParity(repo, identity.commit, output), /Emitted bytes differ from Git/);
});

test("publication admits content changes without model ratings while preserving ancestry", async t => {
  const repo = await fixture(t), baseline = git(repo, ["rev-parse", "HEAD"]);
  await mkdir(join(repo, "eval/candidates/new-skill"), { recursive: true });
  await writeFile(join(repo, "eval/candidates/new-skill/SKILL.md"), "Not a production skill");
  await writeFile(join(repo, "README.md"), "Hosting infrastructure change");
  git(repo, ["add", "."]); git(repo, ["commit", "-m", "Infrastructure and excluded candidate"]);
  assert.equal(requirePublicationGate(repo, git(repo, ["rev-parse", "HEAD"]), baseline).kind, "unchanged-content");
  const output = await buildR2Release(repo, "20260917.4");
  assert.equal(JSON.parse(await readFile(join(output, "inventory.json"))).skills.length, 1);
  await writeFile(join(repo, "skills/demo/references/guide.md"), "Changed instructions");
  git(repo, ["add", "."]); git(repo, ["commit", "-m", "Behavior change without model evaluation"]);
  const candidate = git(repo, ["rev-parse", "HEAD"]);
  const gate = requirePublicationGate(repo, candidate, baseline);
  assert.equal(gate.kind, "validated-content-change");
  assert.equal(gate.human_rating_required, false);
  assert.throws(() => requirePublicationGate(repo, baseline, candidate));
});

test("a superseded workflow cannot publish an older main commit", async t => {
  const repo = await fixture(t), old = git(repo, ["rev-parse", "HEAD"]);
  const remote = await mkdtemp(join(tmpdir(), "gisul-r2-remote-"));
  t.after(() => rm(remote, { recursive: true, force: true }));
  execFileSync("git", ["init", "--bare", remote], { stdio: "pipe" });
  git(repo, ["remote", "add", "origin", remote]);
  git(repo, ["push", "origin", "main"]);
  requireLatestMain(repo, old);
  await writeFile(join(repo, "README.md"), "Newer main commit");
  git(repo, ["add", "."]); git(repo, ["commit", "-m", "Newer main"]); git(repo, ["push", "origin", "main"]);
  assert.throws(() => requireLatestMain(repo, old), /superseded/);
  requireLatestMain(repo, git(repo, ["rev-parse", "HEAD"]));
});

test("real builder bytes upload, stage-check and reconcile a lost activation response through workerd", async t => {
  const repo = await fixture(t);
  for (const name of ["scope", "verify"]) {
    await mkdir(join(repo, "skills", name), { recursive: true });
    await writeFile(join(repo, "skills", name, "SKILL.md"), `---\nname: ${name}\ndescription: Pack fixture\n---\nInstructions\n`);
  }
  await mkdir(join(repo, "packs"));
  const definition = { schema_version: 1, kind: "skill-pack", name: "demo-pack", display_name: "Demo", description: "Fixture pack", scope: "publication", members: [["scope", "scope"], ["demo", "investigate"], ["verify", "verify"]].map(([name, phase]) => ({ uri: `skill://gisul/gisul/${name}/SKILL.md`, phase, selection: "required", when: "Fixture" })) };
  git(repo, ["add", "skills"]); git(repo, ["commit", "-m", "Add pack members"]);
  const beforePack = git(repo, ["rev-parse", "HEAD"]);
  await writeFile(join(repo, "packs/demo-pack.json"), JSON.stringify(definition));
  git(repo, ["add", "packs"]); git(repo, ["commit", "-m", "Add pack only"]);
  const registered = git(repo, ["rev-parse", "HEAD"]);
  assert.equal(requirePublicationGate(repo, registered, beforePack).content_changed, true);
  await writeFile(join(repo, "registration-accounts.json"), JSON.stringify({ [registered]: "fixture" }));
  git(repo, ["add", "registration-accounts.json"]); git(repo, ["commit", "-m", "Record fixture account"]);
  const output = await buildR2Release(repo, "20260917.4");
  const runtime = new Miniflare({ telemetry: { enabled: false }, logRequests: false, workers: [{ config: {
    type: "worker", name: "publisher-test", compatibilityDate: "2026-09-03", exports: {},
    manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: (await bundle).outputFiles[0].text } } },
    env: { GISUL_NATIVE_TOOLS: { type: "text", value: "true" }, SKILLS_BUCKET: { type: "r2", name: "SKILLS_BUCKET" }, GISUL_BEARER_TOKEN: { type: "text", value: "reader" }, GISUL_PUBLISH_TOKEN: { type: "text", value: "publisher" } },
  } }] });
  t.after(() => runtime.dispose());
  const base = (await runtime.ready).origin;
  let pointerWrites = 0;
  const api = releaseApi(base, "publisher", async (url, init) => {
    const response = await fetch(url, init);
    if (url.pathname === "/admin/promote") { pointerWrites++; assert.equal(response.status, 200); throw new Error("Lost successful response"); }
    return response;
  });
  const artifact = await uploadArtifact(api, output);
  const input = { ...artifact.identity, expected_etag: null, sequence: 1 };
  await api("/admin/verify", { method: "POST", body: input, retry: true });
  assert.equal((await smokeR2(base, "reader", artifact.identity, { pinned: true, manifest: artifact.manifest })).packs.packs, 1);
  assert.equal((await api("/admin/current")).current, null);
  const result = await activateVerified(api, "promote", input);
  assert.equal(result.reconciled, true);
  assert.equal(pointerWrites, 1, "a lost acknowledgement must not replay the pointer write");
  assert.equal(result.current.commit, artifact.identity.commit);
  const live = await smokeR2(base, "reader", artifact.identity, { manifest: artifact.manifest });
  assert.equal(live.reads.length, 2);
  assert.equal(live.packs.verified, true);
});

test("an unconfirmed activation response does not cause a second write", async () => {
  let writes = 0;
  const api = async (_path, options) => {
    if (options?.method === "POST") { writes++; throw new Error("Unknown transport failure"); }
    return { current: null, etag: null };
  };
  await assert.rejects(activateVerified(api, "promote", { commit: "a".repeat(40), release: "20260917.4", inventory_digest: "sha256:" + "b".repeat(64) }), /Unknown transport failure/);
  assert.equal(writes, 1);
});

test("matching release bytes cannot reconcile a missing operation sequence", async () => {
  const identity = { commit: "a".repeat(40), release: "20260917.4", inventory_digest: "sha256:" + "b".repeat(64) };
  let writes = 0;
  const api = async (_path, options) => {
    if (options?.method === "POST") { writes++; throw new Error("Unknown transport failure"); }
    return { current: { ...identity, sequence: 1, operation: "promote" }, etag: "earlier" };
  };
  await assert.rejects(activateVerified(api, "rollback", { ...identity, sequence: 2 }), /Unknown transport failure/);
  assert.equal(writes, 1);
});

test("a browser challenge fails once without exposing its HTML body", async () => {
  let requests = 0;
  const api = releaseApi("https://worker.example.invalid", "test-publisher", async () => {
    requests++;
    return new Response("<html>challenge-body-canary</html>", { status: 403, headers: { "content-type": "text/html" } });
  });
  await assert.rejects(api("/admin/current"), error => error.status === 403 && /expected JSON/.test(error.message) && !error.message.includes("challenge-body-canary"));
  assert.equal(requests, 1);
});
