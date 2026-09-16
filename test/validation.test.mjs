import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import { validate } from "../scripts/validate.mjs";

const server = process.env.GISUL_SERVER_PATH ?? fileURLToPath(new URL("../../gisul/server/dist/index.js", import.meta.url));
test("validator and real server agree on metadata, limits, and symlink boundaries", async t => {
  const base = await mkdtemp(join(tmpdir(), "gisul-validation-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, "skills");
  const add = async (name, markdown) => { await mkdir(join(root, name), { recursive: true }); await writeFile(join(root, name, "SKILL.md"), markdown ?? `---\nname: ${name}\ndescription: Test 테스트 workflow\n---\nBody\n`); };
  await add("valid");
  await add("mismatch", "---\nname: other\ndescription: Mismatch\n---\n");
  await add("missing-description", "---\nname: missing-description\n---\n");
  await add("malformed", "---\nname: [\n---\n");
  await add("crlf", "---\r\nname: crlf\r\ndescription: CRLF\r\n---\r\n");
  await add("many-files");
  for (let i = 0; i < 512; i++) await writeFile(join(root, "many-files", `${i}.txt`), "x");
  await add("many-bytes");
  await writeFile(join(root, "many-bytes/large.dat"), Buffer.alloc(16 * 1024 * 1024));
  await mkdir(join(root, "linked-markdown"));
  await symlink(join(root, "valid/SKILL.md"), join(root, "linked-markdown/SKILL.md"));
  await symlink(join(root, "valid"), join(root, "ignored-link"));
  await symlink(join(root, "many-bytes/large.dat"), join(root, "valid/ignored-file"));
  await symlink(root, join(base, "current"));
  const result = await validate(join(base, "current"));
  assert.deepEqual(result.valid.map(skill => skill.dir), ["valid"]);
  assert.equal(result.invalid.length, 7);
  const client = new Client({ name: "gisul-validator-parity", version: "1" });
  const env = { ...process.env, GISUL_SKILLS_DIRS: join(base, "current"), GISUL_URI_AUTHORITY: "gisul", GISUL_ROOT: join(base, "no-release") };
  delete env.GISUL_SKILL_ROOTS;
  delete env.GISUL_RELEASE_FILE;
  const transport = new StdioClientTransport({ command: process.execPath, args: [resolve(server)], env, stderr: "pipe" });
  let stderr = ""; transport.stderr.on("data", bytes => { stderr += bytes; });
  try {
    await client.connect(transport);
    const catalog = await client.request({ method: "skills/list", params: {} }, z.object({ skills: z.array(z.object({ uri: z.string() })) }));
    assert.deepEqual(catalog.skills.map(skill => decodeURIComponent(new URL(skill.uri).pathname.split("/").slice(2, -1).join("/"))).sort(), result.valid.map(skill => skill.dir).sort());
    const skipped = [...stderr.matchAll(/Skipping skill root0\/(.*?):/g)].map(match => match[1]).sort();
    assert.deepEqual(skipped, result.invalid.map(skill => skill.dir).sort());
    await assert.rejects(client.readResource({ uri: "skill://gisul/root0/valid/ignored-file" }), /symbolic|regular/);
    await assert.rejects(client.readResource({ uri: "skill://foreign/root0/valid/SKILL.md" }), /Invalid skill/);
  } finally { await client.close(); }
});

test("description and reference guidance warns without changing server eligibility", async t => {
  const root = await mkdtemp(join(tmpdir(), "gisul-guidance-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "guide"));
  await writeFile(join(root, "guide/SKILL.md"), `---\nname: guide\ndescription: ${"a".repeat(1025)}\n---\n[Missing](references/missing.md)\n`);
  const result = await validate(root);
  assert.equal(result.invalid.length, 0);
  assert.deepEqual(result.warnings.map(item => item.code).sort(), ["bilingual_discovery_keywords", "long_description", "missing_reference"]);
});
