import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRelease } from "./build-release.mjs";
import { releaseId, verifyRelease } from "./release-files.mjs";

const [id, host = "macmini", option] = process.argv.slice(2);
releaseId(id);
if (!/^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(host) || (option && option !== "--rollback")) throw new Error("Usage: release-skills.sh <YYYYMMDD.N> [ssh-host] [--rollback]");
const repo = fileURLToPath(new URL("..", import.meta.url));
const quote = text => `'${text.replaceAll("'", "'\\''")}'`;
const ssh = command => execFileSync("ssh", ["-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, command], { encoding: "utf8", timeout: 120000, maxBuffer: 1024 * 1024 });
const remoteHome = ssh("printf '%s' \"$HOME\"").trim();
if (!/^\/[A-Za-z0-9_./-]+$/.test(remoteHome)) throw new Error("Unsupported remote home path");
const remoteRoot = `${remoteHome}/gisul`;
const tools = `${remoteRoot}/.release-tools`;
ssh(`mkdir -p ${quote(tools)}`);
for (const file of ["release-files.mjs", "release-runtime.mjs"]) execFileSync("scp", [join(repo, "scripts", file), `${host}:${tools}/`], { stdio: "inherit" });
let staging;
let record;
if (option !== "--rollback") {
  const output = await buildRelease(repo, id);
  record = await verifyRelease(output);
  staging = `${remoteRoot}/.release-staging-${id}-${Date.now()}`;
  ssh(`mkdir ${quote(staging)}`);
  execFileSync("rsync", ["-a", `${output}/`, `${host}:${staging}/`], { stdio: "inherit" });
}
const result = JSON.parse(ssh(`/opt/homebrew/bin/node ${quote(`${tools}/release-runtime.mjs`)} ${quote(remoteRoot)} ${quote(id)}${staging ? ` ${quote(staging)}` : ""}`));
await mkdir(join(repo, "dist", "receipts"), { recursive: true });
await writeFile(join(repo, "dist", "receipts", `${id}-${Date.now()}.json`), JSON.stringify({ ...result, host, canonical_repo: repo }, null, 2) + "\n");
if (record) {
  await mkdir(join(repo, "releases"), { recursive: true });
  const log = join(repo, "releases/CHANGELOG.md");
  let previous = "# Skill releases\n\n| Release | Content commit | Evaluation |\n| --- | --- | --- |\n";
  try { previous = await readFile(log, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const line = `| ${id} | ${record.commit} | Content migration; behavioral candidates not promoted |`;
  if (!previous.includes(`| ${id} |`)) await writeFile(log, previous.trimEnd() + "\n" + line + "\n");
  const tag = `release/${id}`;
  const existing = execFileSync("git", ["tag", "--list", tag], { cwd: repo, encoding: "utf8" }).trim();
  if (!existing) execFileSync("git", ["tag", "-a", tag, record.commit, "-m", `Skills ${id}`], { cwd: repo });
  else if (execFileSync("git", ["rev-parse", `${tag}^{commit}`], { cwd: repo, encoding: "utf8" }).trim() !== record.commit) throw new Error("Existing release tag points at another commit");
}
console.log(JSON.stringify(result, null, 2));
