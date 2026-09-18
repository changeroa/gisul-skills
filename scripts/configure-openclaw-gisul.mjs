import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
assert.ok(args.length === 1 && ['--check', '--install'].includes(args[0]), 'Usage: configure-openclaw-gisul.mjs --check|--install');
const command = (program, argv) => execFileSync(program, argv, { encoding: 'utf8', timeout: 90000, stdio: ['ignore', 'pipe', 'pipe'] });
const codexRoot = process.env.CODEX_HOME ?? join(homedir(), '.codex');
const installed = JSON.parse(command('codex', ['plugin', 'list', '--marketplace', 'personal', '--json'])).installed.filter(p => p.pluginId === 'gisul@personal' && p.enabled);
assert.equal(installed.length, 1, 'Expected one enabled gisul plugin');
const cache = join(codexRoot, 'plugins/cache/personal/gisul', installed[0].version);
const source = JSON.parse(await readFile(join(cache, '.mcp.json'), 'utf8')).mcpServers.gisul;
const endpoint = source.args[source.args.indexOf('--http-url') + 1];
const tokenPath = source.args[source.args.indexOf('--bearer-token-file') + 1];
assert.ok(source.args.includes('--http-url') && source.args.includes('--bearer-token-file'));
const url = new URL(endpoint);
assert.ok(url.protocol === 'https:' && !url.username && !url.password && !url.search);
assert.ok(tokenPath && resolve(tokenPath) === tokenPath && !tokenPath.startsWith(cache + '/'));
assert.equal((await stat(tokenPath)).mode & 0o077, 0, 'Reader credential must remain owner-only');
const bundle = await readFile(join(cache, source.args[0]));
const digest = createHash('sha256').update(bundle).digest('hex');
const directory = join(homedir(), '.local/share/dev-tools/openclaw-gisul', digest);
const runtime = join(directory, 'codex.mjs');
const eventLog = join(homedir(), '.local/state/gisul-openclaw/events');
const desired = {
  command: process.execPath, args: [runtime, ...source.args.slice(1)], cwd: directory,
  env: { ...source.env, GISUL_EVENT_LOG_DIR: eventLog },
  connectionTimeoutMs: 30000, requestTimeoutMs: 60000,
  toolFilter: { include: ['search_skills', 'load_skill', 'read_skill_file'] },
};
const current = JSON.parse(command('openclaw', ['mcp', 'list', '--json'])).gisul;
const same = value => value && value.enabled !== false && value.command === desired.command && JSON.stringify(value.args) === JSON.stringify(desired.args) && value.cwd === desired.cwd && value.env?.GISUL_EVENT_LOG_DIR === eventLog && JSON.stringify(value.toolFilter?.include) === JSON.stringify(desired.toolFilter.include);
if (current && !same(current)) throw new Error('An existing gisul registration differs; inspect it before replacing it');
if (args[0] === '--check') {
  console.log(JSON.stringify({ installed: same(current) ?? false, plugin_version: installed[0].version, endpoint, runtime_digest: digest, transport: 'local stdio bridge to Worker HTTPS', action: current ? 'Verify existing registration' : 'Run with --install' }, null, 2));
} else {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try { await writeFile(runtime, bundle, { flag: 'wx', mode: 0o600 }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; assert.deepEqual(await readFile(runtime), bundle, 'Immutable runtime changed'); }
  const flags = ['mcp', 'add', 'gisul', '--command', desired.command, '--cwd', directory, '--connect-timeout', '30', '--timeout', '60', '--include', desired.toolFilter.include.join(',')];
  for (const argument of desired.args) flags.push(`--arg=${argument}`);
  for (const [name, value] of Object.entries(desired.env)) flags.push('--env', `${name}=${value}`);
  if (!current) {
    try { command('openclaw', flags); }
    catch (e) {
      // An interrupted command may already have saved; never blindly add twice.
      if (!same(JSON.parse(command('openclaw', ['mcp', 'list', '--json'])).gisul)) throw new Error('OpenClaw did not verify and save gisul; existing registrations were preserved');
    }
  }
  assert.ok(same(JSON.parse(command('openclaw', ['mcp', 'list', '--json'])).gisul), 'Saved registration differs');
  const probe = JSON.parse(command('openclaw', ['mcp', 'probe', 'gisul', '--json']));
  assert.equal(probe.servers?.gisul?.tools, 3, 'Expected the three verified read tools');
  assert.deepEqual(probe.diagnostics, [], 'OpenClaw reported a connection diagnostic');
  assert.deepEqual([...probe.tools].sort(), ['gisul__load_skill', 'gisul__read_skill_file', 'gisul__search_skills']);
  console.log(JSON.stringify({ installed: true, endpoint, runtime_digest: digest, probe, runtime_restart_performed: false }, null, 2));
}
