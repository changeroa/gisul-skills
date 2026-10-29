import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir, mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { validate, frontmatter } from '../scripts/validate.mjs';
import { readPacks } from '../scripts/packs.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const names = [
  'object-design', 'object-design-workflow', 'object-design-verification',
  'uml-modeling', 'use-case-modeling', 'domain-contract-modeling',
  'responsibility-design', 'pattern-application', 'architecture-modeling'
];
const ownUris = new Set(names.map(n => `skill://gisul/gisul/${n}/SKILL.md`));
const foreignNames = /\b(?:clean-code(?:-[a-z-]+)?|review-orchestrator|review-verifier|review-architecture|review-correctness-state|preserve-decisions|archify|testing(?:-[a-z-]+)?)\b/;

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await files(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

test('object design modules have discoverable bounded entry points and valid support links', async () => {
  const catalog = await validate(join(root, 'skills'));
  assert.deepEqual(catalog.invalid.filter(x => names.includes(x.dir)), []);
  assert.deepEqual(catalog.warnings.filter(x => names.includes(x.dir)), []);
  for (const n of names) {
    const skill = catalog.valid.find(x => x.name === n);
    assert.ok(skill, n);
    const text = await readFile(join(root, 'skills', n, 'SKILL.md'), 'utf8');
    assert.deepEqual(Object.keys(frontmatter(text)).sort(), ['description', 'name']);
    assert.ok(Buffer.byteLength(text) < 32 * 1024, n);
    assert.ok(skill.resources.length >= 1 && skill.resources.length <= 6, n);
    assert.match(text, /권한|허가|승인/, n);
    assert.match(text, /검증|확인/, n);
  }
});

test('standalone pack owns scope, investigation and verification without other packs', async () => {
  const catalog = await validate(join(root, 'skills'));
  const onlyOwn = catalog.valid.filter(x => names.includes(x.name));
  assert.equal(onlyOwn.length, names.length);
  const packs = await readPacks(root, catalog.valid);
  const pack = packs.find(p => p.definition.name === 'object-design-pack').definition;
  assert.deepEqual(new Set(pack.members.map(m => m.uri)), ownUris);
  assert.equal(pack.members.length, names.length);
  assert.equal(pack.members.find(m => m.phase === 'scope').uri, 'skill://gisul/gisul/object-design/SKILL.md');
  assert.equal(pack.members.find(m => m.phase === 'verify').uri, 'skill://gisul/gisul/object-design-verification/SKILL.md');
  assert.ok(pack.members.some(m => m.uri.endsWith('/object-design-workflow/SKILL.md') && m.selection === 'required'));
  const { validatePack } = await import('../scripts/packs.mjs');
  assert.deepEqual(validatePack(pack, ownUris), pack);
  for (const m of pack.members) assert.doesNotMatch(m.uri, foreignNames);
});

test('new pack resources contain neither foreign skill dependencies nor book assets/provenance', async () => {
  const provenance = /UML Distilled|Applying UML and Patterns|Martin Fowler|Craig Larman|oreilly\.com|O[’']Reilly|NextGen|Monopoly|이 책|이 저자/i;
  for (const n of names) {
    for (const p of await files(join(root, 'skills', n))) {
      assert.match(p, /\.md$/, p);
      const text = await readFile(p, 'utf8');
      assert.doesNotMatch(text, provenance, p);
      assert.doesNotMatch(text, foreignNames, p);
      assert.doesNotMatch(text, /tmp\/uml-(?:corpus|notes)|\.aside\/u\/0/, p);
      for (const match of text.matchAll(/skill:\/\/gisul\/gisul\/([^/\s)]+)\//g)) assert.ok(names.includes(match[1]), p);
    }
  }
});

test('a catalog containing only this pack loads all own resources through the real MCP server', async t => {
  const base = await mkdtemp(join(tmpdir(), 'gisul-object-design-independent-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const skills = join(base, 'skills');
  await mkdir(skills);
  for (const n of names) await cp(join(root, 'skills', n), join(skills, n), { recursive: true });
  const server = process.env.GISUL_SERVER_PATH ?? fileURLToPath(new URL('../../gisul/server/dist/index.js', import.meta.url));
  const env = { ...process.env, GISUL_ROOT: join(base, 'no-release'), GISUL_SKILL_ROOTS: `gisul=${skills}`, GISUL_URI_AUTHORITY: 'gisul' };
  delete env.GISUL_SKILLS_DIRS;
  delete env.GISUL_RELEASE_FILE;
  delete env.GISUL_ALIASES_FILE;
  const client = new Client({ name: 'object-design-independence-test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [server], env, stderr: 'pipe' });
  let stderr = '';
  transport.stderr.on('data', bytes => { stderr += bytes; });
  try {
    await client.connect(transport);
    const catalog = await client.request({ method: 'skills/list', params: {} }, z.object({ skills: z.array(z.object({ uri: z.string(), resources: z.array(z.object({ uri: z.string() })) })) }));
    assert.deepEqual(new Set(catalog.skills.map(x => x.uri)), ownUris);
    for (const skill of catalog.skills) {
      for (const resource of skill.resources) {
        const result = await client.readResource({ uri: resource.uri });
        assert.ok(result.contents.length > 0, resource.uri);
        const relativePath = new URL(resource.uri).pathname.split('/').slice(2).map(decodeURIComponent).join('/');
        const expected = await readFile(join(skills, relativePath), 'utf8');
        assert.equal(result.contents.find(c => c.uri === resource.uri)?.text, expected, resource.uri);
      }
    }
    assert.doesNotMatch(stderr, /Skipping skill/);
  } finally { await client.close(); }
});
