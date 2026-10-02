import assert from 'node:assert/strict';
import { readdir, readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { digest } from './release-files.mjs';
export const packUri = name => `pack://gisul/gisul/${name}`;
const phases = ['scope', 'investigate', 'verify', 'handoff', 'explain'];
const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = (v, max) => typeof v === 'string' && !!v.trim() && v.length <= max && !v.includes('\0');
export function validatePack(value, available) {
  assert.ok(object(value) && exact(value, ['schema_version','kind','name','display_name','description','scope','members']) && value.schema_version === 1 && value.kind === 'skill-pack' && typeof value.name === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.name) && value.name.length <= 64 && text(value.display_name,128) && text(value.description,2048) && text(value.scope,4096) && Array.isArray(value.members) && value.members.length >= 3 && value.members.length <= 64, 'Invalid pack definition');
  const seen = new Set();
  for (const m of value.members) {
    assert.ok(object(m) && exact(m,['uri','phase','selection','when']) && typeof m.uri === 'string' && /^skill:\/\/gisul\/gisul\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\/SKILL\.md$/.test(m.uri) && !seen.has(m.uri) && phases.includes(m.phase) && ['required','when_applicable','when_requested'].includes(m.selection) && text(m.when,2048), 'Invalid or duplicate pack member');
    seen.add(m.uri);
    assert.ok(available.has(m.uri), `Unavailable canonical skill reference: ${m.uri}`);
  }
  for (const phase of ['scope','verify']) {
    const members = value.members.filter(m => m.phase === phase);
    assert.ok(members.length === 1 && members[0].selection === 'required', `Pack requires exactly one required ${phase} member`);
  }
  assert.ok(value.members.some(m => m.phase === 'investigate' && m.selection === 'required'), 'Pack requires an investigation member');
  return value;
}
export async function readPacks(root, skills) {
  const dir = join(root, 'packs');
  let names;
  try { names = await readdir(dir); } catch(e) { if (e.code === 'ENOENT') return []; throw e; }
  assert.ok(names.length <= 256, 'Too many packs');
  const available = new Set(skills.map(s => s.uri));
  const entries = [];
  for (const file of names.sort()) {
    assert.match(file, /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/);
    const path = join(dir, file), info = await lstat(path);
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.size <= 256 * 1024, 'Pack must be a bounded regular JSON file');
    const bytes = await readFile(path);
    const definition = validatePack(JSON.parse(bytes), available);
    assert.equal(file, `${definition.name}.json`, 'Pack name differs from filename');
    entries.push({ uri: packUri(definition.name), definition, digest: digest(bytes), size: bytes.length });
  }
  return entries;
}
