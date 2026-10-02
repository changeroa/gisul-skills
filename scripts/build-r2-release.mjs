import { readPacks } from "./packs.mjs";
import { skillRegistrations } from "./skill-registration.mjs";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile, chmod, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRelease } from "./build-release.mjs";
import { digest, inventory, verifyRelease } from "./release-files.mjs";
import { frontmatter, validate } from "./validate.mjs";

export async function verifyR2Release(root) {
  const bytes = await readFile(join(root, "inventory.json"));
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.schema_version, 1);
  const actual = await inventory(root);
  const expected = manifest.files.map(({ path, digest, size, executable }) => ({ path, digest, size, executable }));
  assert.deepEqual(actual, expected, "R2 artifact inventory mismatch");
  const record = JSON.parse(await readFile(join(root, "release.json")));
  assert.equal(record.commit, manifest.commit);
  assert.equal(record.release, manifest.release);
  const packs = await readPacks(root, manifest.skills);
  assert.deepEqual(packs, (manifest.packs ?? []).map(({ registration, ...p }) => p), "Pack index differs from release files");
  return { commit: record.commit, release: record.release, inventory_digest: digest(bytes) };
}

// Keep the original builder unchanged. All skill bytes and its original inventory
// survive in the derived R2 artifact; only the serving index is added.
export async function buildR2Release(repo, id) {
  const source = await buildRelease(repo, id);
  const record = await verifyRelease(source);
  const output = join(repo, "dist/r2", record.commit);
  try {
    const existing = await verifyR2Release(output);
    assert.equal(existing.release, id, "Commit already has another R2 release ID");
    return output;
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const catalog = await validate(join(source, "skills"));
  assert.equal(catalog.invalid.length, 0);
  assert.deepEqual(record.skills, catalog.valid.map(({ name, uri, manifest_digest }) => ({ name, uri, manifest_digest })));
  const uris = new Map();
  const skills = [];
  for (const skill of catalog.valid) {
    const prefix = skill.uri.slice(0, -8);
    for (const resource of skill.resources) {
      const path = `skills/${skill.dir}/${resource.uri.slice(prefix.length).split("/").map(decodeURIComponent).join("/")}`;
      assert.ok(!uris.has(path) || uris.get(path).uri === resource.uri);
      uris.set(path, resource);
    }
    skills.push({ uri: skill.uri, frontmatter: frontmatter(await readFile(join(source, "skills", skill.dir, "SKILL.md"), "utf8")), resources: skill.resources });
  }
  const packs = await readPacks(source, skills);
  if (packs.length) {
    const registrations = await skillRegistrations(repo, record.commit, packs.map(p => ({ dir: p.definition.name, uri: p.uri })), undefined, "packs");
    for (const pack of packs) pack.registration = registrations.get(pack.uri);
  }
  const originalInventory = await readFile(join(source, "inventory.json"));
  const files = JSON.parse(originalInventory).map(file => {
    const resource = uris.get(file.path);
    if (resource) {
      assert.equal(file.digest, resource.digest);
      assert.equal(file.size, resource.size);
    }
    return { ...file, ...(resource ? { uri: resource.uri } : {}) };
  });
  assert.equal(files.filter(file => file.uri).length, uris.size);
  files.push({ path: "build-inventory.json", digest: digest(originalInventory), size: originalInventory.length, executable: false });
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = { schema_version: 1, commit: record.commit, release: id, skills, ...(packs.length ? { packs } : {}), files, aliases: JSON.parse(await readFile(join(source, "aliases.json"))) };
  const staging = `${output}.tmp-${process.pid}`;
  await mkdir(staging, { recursive: true });
  try {
    for (const file of files) {
      const bytes = file.path === "build-inventory.json" ? originalInventory : await readFile(join(source, file.path));
      assert.equal(digest(bytes), file.digest);
      const target = join(staging, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
      await chmod(target, file.executable ? 0o755 : 0o644);
    }
    await writeFile(join(staging, "inventory.json"), JSON.stringify(manifest, null, 2) + "\n");
    await verifyR2Release(staging);
    await rename(staging, output);
    return output;
  } finally { await rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await buildR2Release(fileURLToPath(new URL("..", import.meta.url)), process.argv[2]));
}
