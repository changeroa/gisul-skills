import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { validate, frontmatter } from '../scripts/validate.mjs';
import { readPacks } from '../scripts/packs.mjs';

const root = new URL('..', import.meta.url).pathname;
const names = [
  'product-ux', 'interface-architecture', 'interface-layout',
  'collection-data-design', 'form-command-design', 'interaction-feedback',
  'experience-mapping', 'ui-pattern-systems', 'ux-content', 'ux-research'
];

async function files(dir) {
  const result = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) result.push(...await files(p));
    else if (e.isFile()) result.push(p);
  }
  return result;
}

test('product UX modules are discoverable with closed local references', async () => {
  const catalog = await validate(join(root, 'skills'));
  assert.deepEqual(catalog.invalid.filter(s => names.includes(s.dir)), []);
  assert.deepEqual(catalog.warnings.filter(s => names.includes(s.dir)), []);
  for (const name of names) {
    const skill = catalog.valid.find(s => s.name === name);
    assert.ok(skill, `Missing module ${name}`);
    const text = await readFile(join(root, 'skills', name, 'SKILL.md'), 'utf8');
    const meta = frontmatter(text);
    assert.deepEqual(Object.keys(meta).sort(), ['description', 'name']);
    assert.match(text, /검증|확인/);
    assert.match(text, /권한|허가|승인/);
    assert.ok(skill.resources.length >= 1 && skill.resources.length <= 6);
    assert.ok(Buffer.byteLength(text) < 32 * 1024, 'Keep the entry bounded; split detail into references');
  }
});

test('UX pack preserves specialist selection and existing workflow roles', async () => {
  const catalog = await validate(join(root, 'skills'));
  const packs = await readPacks(root, catalog.valid);
  const pack = packs.find(p => p.definition.name === 'product-ux-pack').definition;
  assert.equal(pack.members.length, 17);
  const entry = pack.members.find(m => m.uri.endsWith('/product-ux/SKILL.md'));
  assert.equal(entry.selection, 'required');
  assert.equal(entry.phase, 'investigate');
  for (const n of names.filter(n => n !== 'product-ux')) {
    const member = pack.members.find(m => m.uri.endsWith(`/${n}/SKILL.md`));
    assert.equal(member.selection, 'when_applicable');
    assert.equal(member.phase, 'investigate');
  }
  assert.equal(pack.members.find(m => m.uri.endsWith('/preserve-decisions/SKILL.md')).phase, 'handoff');
  for (const phase of ['scope', 'verify']) {
    const members = pack.members.filter(m => m.phase === phase);
    assert.equal(members.length, 1);
    assert.equal(members[0].selection, 'required');
  }
});

test('new UX content contains no source provenance or downloaded book assets', async () => {
  const banned = /O[’']?Reilly|oreilly\.com|Jenifer Tidwell|Dan Saffer|Jim Kalbach|Torrey Podmajersky|Brad Nunnally|David Farkas|Diana MacDonald|Mapping Experiences|Microinteractions|Strategic Writing for UX|Practical UI Patterns|Designing Interfaces|この本|이 책|이 저자|\bchapter\s+\d/i;
  for (const n of names) {
    for (const p of await files(join(root, 'skills', n))) {
      assert.match(p, /\.md$/, 'Only authored instructions and references belong in this pack');
      const text = await readFile(p, 'utf8');
      assert.doesNotMatch(text, banned, p);
      assert.doesNotMatch(text, /tmp\/oreilly-corpus|book-notes|\.aside\/u\/0/, p);
    }
  }
});

test('entry routes bounded work without conflating human research and agent QA', async () => {
  const entry = await readFile(join(root, 'skills/product-ux/SKILL.md'), 'utf8');
  for (const n of names.filter(n => n !== 'product-ux')) assert.ok(entry.includes(`\`${n}\``), n);
  for (const n of ['dont-make-me-think','ux-state-review','browser-e2e-review','exploratory-ux-qa','preserve-decisions']) {
    assert.ok(entry.includes(`\`${n}\``), n);
  }
  assert.match(entry, /실제 참여자/);
  assert.match(entry, /정적 화면/);
  assert.match(entry, /배포/);
});
