import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const loginPattern = /^[a-z\d][a-z\d-]{0,38}(?:\[bot\])?$/i;

// Resolve accounts from GitHub, never from skill-controlled frontmatter or the
// publication runner's identity. Exact historical overrides cover unlinked commits.
export function githubActors(repository, token, overrides = {}, fetcher = fetch) {
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  const cache = new Map();
  return commit => {
    assert.match(commit, /^[a-f0-9]{40}$/);
    if (!cache.has(commit)) cache.set(commit, (async () => {
      let login = overrides[commit];
      if (login === undefined) {
        assert.ok(token, "GitHub read token is required to resolve registration accounts");
        const response = await fetcher(`https://api.github.com/repos/${repository}/commits/${commit}`, {
          headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "gisul-registration" },
          redirect: "error", signal: AbortSignal.timeout(15_000),
        });
        assert.ok(response.ok, `Cannot resolve registration account for ${commit}: GitHub ${response.status}`);
        const result = await response.json();
        assert.equal(result.sha, commit, "GitHub returned a different commit");
        login = result.author?.login;
      }
      assert.ok(typeof login === "string" && loginPattern.test(login), `Unlinked Git author at ${commit}; review and record an exact historical account mapping`);
      return login;
    })());
    return cache.get(commit);
  };
}

export async function skillRegistrations(repo, commit, skills, actor, kind = "skills") {
  const git = args => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  assert.match(commit, /^[a-f0-9]{40}$/);
  assert.equal(git(["rev-parse", "--is-shallow-repository"]), "false", "Registration requires complete Git history");
  if (!actor) {
    const overrides = JSON.parse(await readFile(join(repo, "registration-accounts.json"), "utf8"));
    actor = githubActors(process.env.GITHUB_REPOSITORY ?? "changeroa/gisul-skills", process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN, overrides);
  }
  const result = new Map();
  for (const { dir, uri } of skills) {
    assert.ok(dir && !dir.split("/").some(part => !part || part.startsWith(".")));
    const history = (path, extra = []) => git(["log", "--first-parent", "--format=%H%x09%cI", ...extra, commit, "--", path]).split("\n").filter(Boolean).map(line => {
      const [sha, date] = line.split("\t");
      return { sha, date: new Date(date).toISOString() };
    });
    const created = history(kind === "packs" ? `packs/${dir}.json` : `skills/${dir}/SKILL.md`, ["--diff-filter=A"]).at(-1);
    const updated = history(kind === "packs" ? `packs/${dir}.json` : `skills/${dir}/`)[0];
    assert.ok(created && updated, `No registration history for ${dir}`);
    assert.ok(updated.date >= created.date, `Invalid registration chronology for ${dir}`);
    result.set(uri, { created_by: await actor(created.sha), created_at: created.date, updated_by: await actor(updated.sha), updated_at: updated.date });
  }
  return result;
}
