import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const digest = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
export function releaseId(value) {
  if (!/^\d{8}\.[1-9]\d*$/.test(value ?? "")) throw new Error("Release ID must be YYYYMMDD.N");
  return value;
}
export async function inventory(root) {
  const files = [];
  async function visit(dir, prefix = "") {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (name === "inventory.json") continue;
      if (entry.isSymbolicLink()) throw new Error(`Release cannot contain symbolic links: ${name}`);
      if (entry.isDirectory()) await visit(join(dir, entry.name), name + "/");
      else if (entry.isFile()) {
        const contents = await readFile(join(dir, entry.name));
        files.push({ path: name, digest: digest(contents), size: contents.length, executable: !!((await lstat(join(dir, entry.name))).mode & 0o111) });
      } else throw new Error(`Unsupported release entry: ${name}`);
    }
  }
  await visit(root);
  return files.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export async function verifyRelease(root) {
  if (!(await lstat(root)).isDirectory()) throw new Error("Release root must be a regular directory");
  const record = JSON.parse(await readFile(join(root, "release.json"), "utf8"));
  releaseId(record.release);
  if (!/^[a-f0-9]{40}$/.test(record.commit) || !record.skills?.length) throw new Error("Invalid release metadata");
  const expected = JSON.parse(await readFile(join(root, "inventory.json"), "utf8"));
  const actual = await inventory(root);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Release inventory mismatch");
  return { ...record, inventory_digest: digest(JSON.stringify(expected)) };
}
