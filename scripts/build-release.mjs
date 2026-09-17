import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.mjs";
import { inventory, releaseId, verifyRelease } from "./release-files.mjs";

export async function buildRelease(repo, id) {
  releaseId(id);
  const git = args => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  if (git(["status", "--porcelain"])) throw new Error("Commit all changes before building a release");
  const commit = git(["rev-parse", "HEAD"]);
  const output = join(repo, "dist", id);
  try {
    await readFile(join(output, "release.json"));
    const old = await verifyRelease(output);
    if (old.commit !== commit) throw new Error("Release ID already belongs to another commit");
    return output;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const staging = `${output}.tmp-${process.pid}`;
  await mkdir(staging, { recursive: true });
  try {
    const paths = ["skills", "aliases.json", "projects", "policies"].filter(name => git(["ls-tree", "--name-only", "HEAD", name]));
    const archive = execFileSync("git", ["archive", "--format=tar", commit, ...paths], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
    execFileSync("tar", ["-xf", "-", "-C", staging], { input: archive });
    const catalog = await validate(join(staging, "skills"));
    if (!catalog.valid.length || catalog.invalid.length) throw new Error(`Invalid release catalog: ${JSON.stringify(catalog.invalid)}`);
    const aliases = JSON.parse(await readFile(join(staging, "aliases.json"), "utf8"));
    const uris = new Set(catalog.valid.map(skill => skill.uri));
    if (Object.entries(aliases).some(([from,to]) => !/^skill:\/\/gisul\//.test(from) || !uris.has(to))) throw new Error("Alias targets must be canonical release skills");
    const record = { release: id, commit, created_at: git(["show", "-s", "--format=%cI", "HEAD"]), skills: catalog.valid.map(({ name, uri, manifest_digest }) => ({ name, uri, manifest_digest })) };
    await writeFile(join(staging, "release.json"), JSON.stringify(record, null, 2) + "\n");
    await writeFile(join(staging, "inventory.json"), JSON.stringify(await inventory(staging), null, 2) + "\n");
    await verifyRelease(staging);
    await rename(staging, output);
    return output;
  } finally { await rm(staging, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  console.log(await buildRelease(repo, process.argv[2]));
}
