import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { skillRegistrations, githubActors } from "../scripts/skill-registration.mjs";

const uri = "skill://gisul/gisul/example/SKILL.md";
const skills = [{ dir: "example", uri }];
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "gisul-registration-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (args, env = {}) => execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] }).trim();
  git(["init", "-b", "main"]); git(["config", "user.name", "Fixture"]); git(["config", "user.email", "fixture@example.test"]);
  const write = async (path, text) => { await mkdir(join(root, path, ".."), { recursive: true }); await writeFile(join(root, path), text); };
  const commit = (date, message = "change") => { git(["add", "."]); git(["commit", "-m", message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }); return git(["rev-parse", "HEAD"]); };
  await write("aliases.json", "{}\n");
  await write(".gitignore", "dist/\n");
  commit("2026-09-01T00:00:00Z", "bootstrap");
  await write("skills/example/SKILL.md", "---\nname: example\ndescription: Example workflow\ncreated_by: forged\n---\nRead [guide](references/guide.md).\n");
  await write("skills/example/references/guide.md", "Original guide\n");
  const created = commit("2026-09-02T01:00:00Z", "register");
  return { root, git, write, commit, created };
}

test("registration survives support edits, unrelated publication and pinned history", async t => {
  const f = await fixture(t);
  await f.write("skills/example/references/guide.md", "Edited guide\n");
  const edited = f.commit("2026-09-03T02:00:00Z");
  await f.write("README.md", "No skill change\n");
  const head = f.commit("2026-09-04T03:00:00Z");
  const actor = async sha => sha === f.created ? "alice" : sha === edited ? "bob" : assert.fail("Unrelated commit used");
  const result = (await skillRegistrations(f.root, head, skills, actor)).get(uri);
  assert.deepEqual(result, { created_by: "alice", created_at: "2026-09-02T01:00:00.000Z", updated_by: "bob", updated_at: "2026-09-03T02:00:00.000Z" });
  const old = (await skillRegistrations(f.root, f.created, skills, actor)).get(uri);
  assert.equal(old.updated_by, "alice"); assert.equal(old.updated_at, old.created_at);
});

test("a merged import records its team landing date rather than the branch creation date", async t => {
  const f = await fixture(t);
  f.git(["checkout", "-b", "import"]);
  await f.write("skills/imported/SKILL.md", "---\nname: imported\ndescription: imported workflow\n---\nContent\n");
  const original = f.commit("2026-09-05T00:00:00Z");
  f.git(["checkout", "main"]);
  f.git(["merge", "--no-ff", "import", "-m", "land import"], { GIT_AUTHOR_DATE: "2026-09-10T00:00:00Z", GIT_COMMITTER_DATE: "2026-09-10T00:00:00Z" });
  const landed = f.git(["rev-parse", "HEAD"]);
  const result = await skillRegistrations(f.root, landed, [{ dir: "imported", uri: "imported" }], async sha => { assert.equal(sha, landed); assert.notEqual(sha, original); return "registrant"; });
  assert.equal(result.get("imported").created_at, "2026-09-10T00:00:00.000Z");
});

test("GitHub actor resolution is cached, fails closed, and accepts only exact reviewed overrides", async () => {
  const commit = "a".repeat(40); let calls = 0;
  const actor = githubActors("Ark-Point/gisul-skills", "test-token", {}, async (url, init) => {
    calls++; assert.ok(url.endsWith(commit)); assert.equal(init.headers.authorization, "Bearer test-token");
    return Response.json({ sha: commit, author: { login: "teammate" } });
  });
  assert.deepEqual(await Promise.all([actor(commit), actor(commit)]), ["teammate", "teammate"]); assert.equal(calls, 1);
  for (const response of [Response.json({}, { status: 403 }), Response.json({ sha: commit, author: null }), Response.json({ sha: "b".repeat(40), author: { login: "other" } })]) {
    await assert.rejects(githubActors("Ark-Point/gisul-skills", "test-token", {}, async () => response)(commit));
  }
  assert.equal(await githubActors("Ark-Point/gisul-skills", undefined, { [commit]: "known-member" })(commit), "known-member");
  await assert.rejects(githubActors("Ark-Point/gisul-skills", undefined, { [commit]: "known-member" })("b".repeat(40)));
});

