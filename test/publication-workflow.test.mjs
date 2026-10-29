import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { parse } from 'yaml';

test('publication requires manual dispatch and an explicit current endpoint before validation', async () => {
  const workflow = parse(await readFile(new URL('../.github/workflows/publish-r2.yml', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.jobs.validate.needs, 'require-target');
  assert.equal(workflow.jobs.publish.needs, 'validate');
  const guard = workflow.jobs['require-target'].steps[0];
  assert.equal(guard.env.SKILLAR_RELEASE_BASE_URL, '${{ vars.SKILLAR_RELEASE_BASE_URL }}');
  const publication = workflow.jobs.publish.steps.find(step => step.run === 'node scripts/publish-r2.mjs');
  assert.equal(publication.env.SKILLAR_RELEASE_BASE_URL, '${{ vars.SKILLAR_RELEASE_BASE_URL }}');
  const run = env => spawnSync('bash', ['-c', guard.run], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  for (const current of ['', '   ']) {
    const result = run({ SKILLAR_RELEASE_BASE_URL: current, GISUL_RELEASE_BASE_URL: 'https://retired.invalid' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /requires repository variable SKILLAR_RELEASE_BASE_URL/);
  }
  assert.equal(run({ SKILLAR_RELEASE_BASE_URL: 'https://explicit-current.invalid' }).status, 0);
});

test('publisher rejects missing targets and automatic events before any publication work', () => {
  const script = new URL('../scripts/publish-r2.mjs', import.meta.url).pathname;
  const invoke = env => spawnSync(process.execPath, [script], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' });
  const retiredOnly = invoke({ GISUL_RELEASE_BASE_URL: 'https://retired.invalid' });
  assert.notEqual(retiredOnly.status, 0);
  assert.match(retiredOnly.stderr, /Manual R2 publication requires explicit SKILLAR_RELEASE_BASE_URL/);
  const automatic = invoke({ SKILLAR_RELEASE_BASE_URL: 'https://explicit-current.invalid', GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' });
  assert.notEqual(automatic.status, 0);
  assert.match(automatic.stderr, /explicit manual workflow dispatch/);
});
