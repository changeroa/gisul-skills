import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { digest } from "./release-files.mjs";

// Last accepted content includes dont-make-me-think in release 20260917.3.
export const MIGRATION_BASELINE = "1ce932b32750d0df3ca74939189dc1d575a3a700";
export const CONTENT_PATHS = ["skills", "aliases.json", "projects", "policies"];

export function git(repo, args) {
  return execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

export function contentIdentity(repo, commit) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  return digest(execFileSync("git", ["ls-tree", "-r", "-z", commit, "--", ...CONTENT_PATHS], { cwd: repo }));
}

export function requirePublicationGate(repo, candidate, baseline = MIGRATION_BASELINE) {
  assert.match(candidate, /^[a-f0-9]{40}$/);
  assert.match(baseline, /^[a-f0-9]{40}$/);
  git(repo, ["merge-base", "--is-ancestor", baseline, candidate]);
  const before = contentIdentity(repo, baseline), after = contentIdentity(repo, candidate);
  if (before !== after) throw new Error("Behavioral content changed. Publication is blocked until the model, critical-case, holdout, cost and human-rating evaluation in eval/README.md is completed and its evidence gate is connected. Static validation cannot approve this change.");
  return { kind: "unchanged-content", baseline, candidate, content_digest: after, behavioral_candidates_promoted: false };
}

export function requireLatestMain(repo, candidate) {
  git(repo, ["fetch", "--no-tags", "origin", "main"]);
  if (git(repo, ["rev-parse", "FETCH_HEAD"]) !== candidate) throw new Error("This run is superseded by a newer main commit; current was not switched");
}

// Check emitted bytes against Git objects independently of the builder's inventory.
export async function requireGitContentParity(repo, commit, root) {
  assert.match(commit, /^[a-f0-9]{40}$/);
  const format = git(repo, ["rev-parse", "--show-object-format"]);
  const rows = execFileSync("git", ["ls-tree", "-r", "-z", commit, "--", ...CONTENT_PATHS], { cwd: repo }).toString("utf8").split("\0").filter(Boolean);
  const manifest = JSON.parse(await readFile(join(root, "inventory.json")));
  const files = new Map(manifest.files.filter(file => CONTENT_PATHS.some(path => file.path === path || file.path.startsWith(path + "/"))).map(file => [file.path, file]));
  assert.equal(files.size, rows.length, "Emitted content membership differs from Git");
  for (const row of rows) {
    const match = /^(100644|100755) blob ([a-f0-9]+)\t(.+)$/.exec(row);
    assert.ok(match, "Published content must contain only regular Git files");
    const [, mode, oid, path] = match;
    assert.ok(files.has(path), `Missing Git content: ${path}`);
    const bytes = await readFile(join(root, path));
    const actual = createHash(format).update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    assert.equal(actual, oid, `Emitted bytes differ from Git: ${path}`);
    assert.equal(files.get(path).executable, mode === "100755", `Emitted mode differs from Git: ${path}`);
  }
  return { git_object_format: format, files: rows.length, exact_git_bytes: true };
}
