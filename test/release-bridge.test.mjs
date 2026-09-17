import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { validate } from "../scripts/validate.mjs";

test("the imported catalog loads through the real bridge with release identity and all 28 old URIs", { timeout: 60000 }, async t => {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  const root = await mkdtemp(join(tmpdir(), "gisul-release-bridge-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const catalog = await validate(join(repo, "skills"));
  assert.equal(catalog.invalid.length, 0);
  const aliases = JSON.parse(await readFile(join(repo, "aliases.json"), "utf8"));
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
  const release = "fixture-20260916.1";
  await writeFile(join(root, "release.json"), JSON.stringify({ release, commit, skills: catalog.valid.map(({ uri, manifest_digest }) => ({ uri, manifest_digest })) }));
  const server = process.env.GISUL_SERVER_PATH ?? fileURLToPath(new URL("../../gisul/server/dist/index.js", import.meta.url));
  const client = new Client({ name: "release-bridge-parity", version: "1" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [join(dirname(server), "codex.js"), "--origin", "release-acceptance-fixture", "--", "env", `GISUL_ROOT=${root}`, `GISUL_SKILL_ROOTS=gisul=${join(repo, "skills")}`, `GISUL_RELEASE_FILE=${join(root, "release.json")}`, `GISUL_ALIASES_FILE=${join(repo, "aliases.json")}`, process.execPath, server], env: { ...process.env, GISUL_EVENT_LOG_DIR: join(root, "events") }, stderr: "pipe" });
  transport.stderr.on("data", () => {});
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse(result.content[0].text);
  };
  try {
    await client.connect(transport);
    assert.equal((await call("search_skills", { limit: 50 })).totalMatches, catalog.valid.length);
    assert.equal(Object.keys(aliases).length, 28);
    for (const [oldUri, uri] of Object.entries(aliases)) {
      const loaded = await call("load_skill", { uri: oldUri });
      assert.equal(loaded.uri, uri);
      assert.equal(loaded.movedFrom, oldUri);
      assert.equal(loaded.release, release);
      assert.equal(loaded.commit, commit);
      assert.equal(loaded.manifest_digest, catalog.valid.find(skill => skill.uri === uri).manifest_digest);
    }
    const archify = catalog.valid.find(skill => skill.name === "archify");
    const loaded = await call("load_skill", { uri: archify.uri });
    assert.equal(loaded.filesFolded, true);
    assert.ok(loaded.files.length < archify.resources.length);
    const directory = loaded.files.find(uri => uri.endsWith("/references"));
    assert.ok(directory);
    const expanded = await call("read_skill_file", { skill_uri: loaded.uri, uri: directory });
    assert.ok(expanded.files.length > 0);
    const file = expanded.files.find(uri => uri.endsWith(".md"));
    assert.ok(file);
    const read = await call("read_skill_file", { skill_uri: loaded.uri, uri: file });
    assert.equal(read.release, release);
    assert.equal(read.manifest_digest, loaded.manifest_digest);
    assert.ok(read.text.length > 0);
  } finally { await client.close(); }
});
