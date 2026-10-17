import { execFile, execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const source = fileURLToPath(new URL("../..", import.meta.url));

export async function publicationFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "gisul-publish-preflight-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(join(source, "scripts"), join(root, "scripts"), { recursive: true });
  await symlink(join(source, "node_modules"), join(root, "node_modules"), "dir");
  const git = args => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
  git(["init", "-b", "main"]);
  git(["config", "user.name", "Fixture"]);
  git(["config", "user.email", "fixture@example.invalid"]);
  git(["commit", "--allow-empty", "-m", "Publication preflight fixture"]);
  git(["remote", "add", "origin", root]);
  const env = {
    PATH: process.env.PATH,
    HOME: root,
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY: "changeroa/gisul-skills",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: git(["rev-parse", "HEAD"]),
    GITHUB_RUN_NUMBER: "7",
    GITHUB_RUN_ID: "123",
    GITHUB_TOKEN: "fixture-github-secret",
    GISUL_BEARER_TOKEN: "fixture-reader-secret",
    GISUL_PUBLISH_TOKEN: "fixture-publisher-secret",
    GISUL_RELEASE_BASE_URL: "https://publication.example.invalid",
  };
  return {
    root,
    env,
    async run(changes = {}) {
      let result;
      try {
        result = { code: 0, ...await execute(process.execPath, ["scripts/publish-r2.mjs"], {
          cwd: root, env: { ...env, ...changes }, timeout: 15_000,
        }) };
      } catch (error) {
        result = { code: error.code, stdout: error.stdout, stderr: error.stderr };
      }
      const receipt = JSON.parse(await readFile(join(root, "dist/receipts/r2-publication.json"), "utf8"));
      return { ...result, receipt };
    },
  };
}
