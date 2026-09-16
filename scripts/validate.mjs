import { createHash } from "node:crypto";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const sha256 = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const uri = (...parts) => `skill://gisul/gisul/${parts.flatMap(part => part.split("/")).map(encodeURIComponent).join("/")}`;
export function frontmatter(markdown) {
  if (!markdown.startsWith("---\n")) return null;
  const end = markdown.indexOf("\n---", 4);
  if (end === -1 || !["", "\n"].includes(markdown.slice(end + 4, end + 5))) return null;
  try { const value = parse(markdown.slice(4, end)); return value && typeof value === "object" && !Array.isArray(value) ? value : null; } catch { return null; }
}

export async function skillDirectories(root) {
  const dirs = [];
  async function visit(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      try { if ((await stat(join(dir, entry.name, "SKILL.md"))).isFile()) dirs.push(name); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      await visit(join(dir, entry.name), name);
    }
  }
  await visit(root, "");
  return dirs.sort();
}

export async function skillFiles(root) {
  const files = [];
  async function visit(dir, prefix) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(join(dir, entry.name), name);
      else if (entry.isFile()) files.push(name);
    }
  }
  await visit(root, "");
  return files.sort();
}

export async function validate(root = new URL("../skills", import.meta.url)) {
  root = resolve(root instanceof URL ? fileURLToPath(root) : root);
  const valid = [], invalid = [], warnings = [];
  for (const dir of await skillDirectories(root)) {
    const directory = join(root, dir);
    const reject = reason => invalid.push({ dir, reason });
    const info = await lstat(join(directory, "SKILL.md"));
    if (!info.isFile() || info.isSymbolicLink()) { reject("SKILL.md must be a regular file"); continue; }
    const markdown = await readFile(join(directory, "SKILL.md"), "utf8");
    const meta = frontmatter(markdown);
    if (!meta || typeof meta.name !== "string" || !meta.name || typeof meta.description !== "string" || !meta.description) { reject("SKILL.md frontmatter requires name and description"); continue; }
    if (meta.name !== basename(dir)) { reject(`frontmatter name "${meta.name}" does not match directory name`); continue; }
    const resources = [];
    let bytes = 0;
    for (const file of await skillFiles(directory)) {
      const contents = await readFile(join(directory, file)); bytes += contents.length;
      resources.push({ uri: uri(dir, file), digest: sha256(contents), size: contents.length });
    }
    if (resources.length > 512 || bytes > 16 * 1024 * 1024) { reject(`exceeds SEP-2640 limits (${resources.length} resources, ${bytes} bytes)`); continue; }
    const ordered = resources.slice().sort((a, b) => a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0);
    valid.push({ dir, name: meta.name, description: meta.description, uri: uri(dir, "SKILL.md"), resources, manifest_digest: sha256(JSON.stringify(ordered)) });
    if (meta.description.length > 1024) warnings.push({ dir, code: "long_description", length: meta.description.length });
    const discovery = `${meta.description} ${Array.isArray(meta.keywords) ? meta.keywords.join(" ") : ""}`;
    if (!/[가-힣]/.test(discovery) || !/[a-z]/i.test(discovery)) warnings.push({ dir, code: "bilingual_discovery_keywords" });
    for (const match of markdown.matchAll(/\[[^\]]*\]\(<?((?:\.\/)?(?:references|scripts|assets)\/[^\s)>]+)>?\)/g)) {
      const target = resolve(directory, decodeURIComponent(match[1].split("#")[0]));
      const inside = relative(directory, target);
      let present = false;
      try { const targetInfo = await lstat(target); present = !inside.startsWith("..") && !targetInfo.isSymbolicLink() && (targetInfo.isFile() || targetInfo.isDirectory()); } catch {}
      if (!present) warnings.push({ dir, code: "missing_reference", target: match[1] });
    }
  }
  return { valid, invalid, warnings, total: valid.length + invalid.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validate(process.argv[2]);
  console.log(JSON.stringify({ ...result, valid: result.valid.map(skill => skill.dir) }, null, 2));
  process.exitCode = result.invalid.length ? 1 : 0;
}
