import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

const host = process.argv[2] ?? "macmini";
if (process.argv.length > 3 || !/^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(host)) throw new Error("Usage: node scripts/import-from-gisul.mjs [ssh-host]");
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const client = new Client({ name: "gisul-content-import", version: "1" });
const transport = new StdioClientTransport({ command: "ssh", args: ["-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, "gisul"], stderr: "pipe", maxBufferSize: 32 * 1024 * 1024 });
transport.stderr.on("data", () => {});
const hash = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
try {
  await client.connect(transport);
  const schema = z.object({ skills: z.array(z.object({ uri: z.string(), frontmatter: z.object({ name: z.string() }).passthrough(), resources: z.array(z.object({ uri: z.string(), digest: z.string(), size: z.number() })) })), nextCursor: z.string().optional() });
  const skills = []; const cursors = new Set(); let cursor;
  do {
    const page = await client.request({ method: "skills/list", params: cursor ? { cursor } : {} }, schema);
    skills.push(...page.skills); cursor = page.nextCursor;
    if (cursor && cursors.has(cursor)) throw new Error("Repeated upstream cursor");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  const names = new Set();
  const aliases = {};
  const inventory = [];
  for (const skill of skills) {
    const name = skill.frontmatter.name;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || names.has(name)) throw new Error(`Cannot flatten duplicate or invalid skill name: ${name}`);
    names.add(name);
    const oldRoot = skill.uri.slice(0, -8);
    if (!skill.uri.endsWith("/SKILL.md") || !skill.resources.some(file => file.uri === skill.uri)) throw new Error("Incomplete source manifest");
    const newUri = `skill://gisul/gisul/${name}/SKILL.md`;
    if (skill.uri !== newUri) aliases[skill.uri] = newUri;
    for (const resource of skill.resources) {
      if (!resource.uri.startsWith(oldRoot)) throw new Error("Resource escaped its skill manifest");
      const parts = resource.uri.slice(oldRoot.length).split("/").map(decodeURIComponent);
      if (parts.some(part => !part || [".", ".."].includes(part) || /[\\/\0]/.test(part))) throw new Error("Unsafe manifest path");
      const result = await client.readResource({ uri: resource.uri });
      if (result.contents.length !== 1 || result.contents[0].uri !== resource.uri) throw new Error("Unexpected resource response");
      const content = result.contents[0];
      const bytes = "text" in content ? Buffer.from(content.text) : Buffer.from(content.blob, "base64");
      if (bytes.length !== resource.size || hash(bytes) !== resource.digest) throw new Error(`Source changed during import: ${resource.uri}`);
      const destination = join(repo, "skills", name, ...parts);
      await mkdir(dirname(destination), { recursive: true });
      try { await writeFile(destination, bytes, { flag: "wx" }); }
      catch (error) { if (error.code !== "EEXIST" || !(await readFile(destination)).equals(bytes)) throw error; }
    }
    inventory.push({ name, original_uri: skill.uri, uri: newUri, resources: skill.resources.length, bytes: skill.resources.reduce((n, item) => n + item.size, 0) });
    console.log(JSON.stringify(inventory.at(-1)));
  }
  await mkdir(join(repo, "migration"), { recursive: true });
  await writeFile(join(repo, "aliases.json"), JSON.stringify(aliases, null, 2) + "\n");
  await writeFile(join(repo, "migration/import.json"), JSON.stringify({ imported_at: new Date().toISOString(), origin: host, skills: inventory }, null, 2) + "\n");
  console.log(JSON.stringify({ imported: inventory.length, aliases: Object.keys(aliases).length }));
} finally { await client.close(); }
