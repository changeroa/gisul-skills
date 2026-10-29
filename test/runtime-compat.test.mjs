import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { selectInstalledPlugin, selectReleaseConfiguration, selectSkillarServer } from '../scripts/runtime-compat.mjs';
import { inventory, verifyRelease } from '../scripts/release-files.mjs';

async function homeDirectory(t) {
  const home = await mkdtemp(join(tmpdir(), 'skillar-upgrade-'));
  t.after(() => rm(home, { recursive: true, force: true }));
  const write = async (path, value = 'fixture') => {
    await mkdir(join(home, path, '..'), { recursive: true });
    const fullPath = join(home, path);
    await writeFile(fullPath, value, { mode: 0o600 });
    return fullPath;
  };
  return { home, write };
}

test('release selectors retain a legacy install, prefer the upgrade and honor explicit configuration', async t => {
  const { home, write } = await homeDirectory(t);
  const oldPlist = await write('Library/LaunchAgents/com.iyendev.gisul-mcp.plist');
  const oldToken = await write('.config/secrets/gisul-mcp-bearer-token', 'retained credential');
  assert.deepEqual(await selectReleaseConfiguration({ home, env: {} }), {
    label: 'com.iyendev.gisul-mcp', plist: oldPlist, tokenFile: oldToken,
  });
  const newPlist = await write('Library/LaunchAgents/com.iyendev.skillar-mcp.plist');
  // A partial upgrade can retain its original credential without moving it.
  assert.equal((await selectReleaseConfiguration({ home, env: {} })).tokenFile, oldToken);
  const newToken = await write('.config/secrets/skillar-mcp-bearer-token');
  assert.deepEqual(await selectReleaseConfiguration({ home, env: {} }), {
    label: 'com.iyendev.skillar-mcp', plist: newPlist, tokenFile: newToken,
  });
  const plist = await write('custom/runtime.plist'), tokenFile = await write('custom/token');
  assert.deepEqual(await selectReleaseConfiguration({ home, env: {
    SKILLAR_LAUNCHD_LABEL: 'custom.runtime', SKILLAR_LAUNCHD_PLIST: plist,
    SKILLAR_BEARER_TOKEN_FILE: tokenFile, GISUL_BEARER_TOKEN_FILE: oldToken,
  } }), { label: 'custom.runtime', plist, tokenFile });
  assert.equal(await readFile(oldToken, 'utf8'), 'retained credential', 'selection must not migrate or replace credentials');
  await assert.rejects(selectReleaseConfiguration({ home, env: { SKILLAR_BEARER_TOKEN_FILE: join(home, 'missing') } }), /Configured file does not exist/);
  await assert.rejects(selectReleaseConfiguration({ home, env: { SKILLAR_LAUNCHD_LABEL: 'missing.service' } }), /Configured file does not exist/);
  await assert.rejects(selectReleaseConfiguration({ home, env: { SKILLAR_LAUNCHD_PLIST: plist } }), /Set SKILLAR_LAUNCHD_LABEL/);
  await assert.rejects(selectReleaseConfiguration({ home, env: { SKILLAR_BEARER_TOKEN_FILE: '' } }), /nonempty/);
});

test('release CLI restarts the retained legacy label and uses its credential without rewriting release bytes', async t => {
  const { home, write } = await homeDirectory(t);
  await write('Library/LaunchAgents/com.iyendev.gisul-mcp.plist');
  const token = await write('.config/secrets/gisul-mcp-bearer-token');
  const root = join(home, 'gisul'), id = '20261029.1', content = join(root, 'releases', id);
  await write(`gisul/releases/${id}/release.json`, JSON.stringify({ release: id, commit: 'a'.repeat(40), skills: [{ uri: 'skill://gisul/gisul/demo/SKILL.md' }] }));
  await write(`gisul/releases/${id}/skills/demo/SKILL.md`, 'original immutable content');
  await writeFile(join(content, 'inventory.json'), JSON.stringify(await inventory(content)));
  const before = await verifyRelease(content);
  await write('gisul/server/smoke-server.mjs', `
    import { appendFile, readFile } from 'node:fs/promises';
    export async function smokeServer({ env }) {
      await appendFile(process.env.SMOKE_LOG, JSON.stringify({ token: env.SKILLAR_BEARER_TOKEN_FILE }) + '\\n');
      return { release: JSON.parse(await readFile(env.SKILLAR_RELEASE_FILE, 'utf8')).release };
    }
  `);
  const launchctl = await write('bin/launchctl', `#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.LAUNCHD_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');\n`);
  await chmod(launchctl, 0o755);
  const log = join(home, 'launchd.log'), smokeLog = join(home, 'smoke.log');
  execFileSync(process.execPath, [new URL('../scripts/release-runtime.mjs', import.meta.url).pathname, root, id], {
    env: { HOME: home, PATH: join(home, 'bin'), LAUNCHD_LOG: log, SMOKE_LOG: smokeLog }, timeout: 10000,
  });
  assert.deepEqual(JSON.parse((await readFile(log, 'utf8')).trim()), ['kickstart', '-k', `gui/${process.getuid()}/com.iyendev.gisul-mcp`]);
  assert.ok((await readFile(smokeLog, 'utf8')).trim().split('\n').every(line => JSON.parse(line).token === token));
  assert.equal(await readlink(join(root, 'current')), `releases/${id}`);
  assert.deepEqual(await verifyRelease(content), before);
});

test('invalid primary files fail instead of silently selecting a legacy service', async t => {
  const { home, write } = await homeDirectory(t);
  await write('Library/LaunchAgents/com.iyendev.gisul-mcp.plist');
  await write('.config/secrets/gisul-mcp-bearer-token');
  await mkdir(join(home, 'Library/LaunchAgents/com.iyendev.skillar-mcp.plist'));
  await assert.rejects(selectReleaseConfiguration({ home, env: {} }), /Expected a regular file/);
});

test('installed plugin selection uses the matching legacy cache and prefers a verified new registration', async t => {
  const { home: codexRoot, write } = await homeDirectory(t);
  const legacy = { pluginId: 'gisul@personal', enabled: true, version: 'old' };
  const upgraded = { pluginId: 'skillar@personal', enabled: true, version: 'new' };
  await write('plugins/cache/personal/gisul/old/.mcp.json', JSON.stringify({ mcpServers: { gisul: { command: 'old-runtime' } } }));
  await write('plugins/cache/personal/skillar/new/.mcp.json', JSON.stringify({ mcpServers: { skillar: { command: 'new-runtime' } } }));
  async function selected(entries) {
    const plugin = selectInstalledPlugin(entries, codexRoot);
    const servers = JSON.parse(await readFile(join(plugin.cache, '.mcp.json'), 'utf8')).mcpServers;
    return { plugin, server: selectSkillarServer(servers) };
  }
  assert.equal((await selected([legacy])).server.config.command, 'old-runtime');
  assert.equal((await selected([legacy, upgraded])).server.config.command, 'new-runtime');
  assert.equal((await selected([legacy, { ...upgraded, enabled: false }])).plugin.name, 'gisul');
  assert.throws(() => selectInstalledPlugin([legacy, upgraded, upgraded], codexRoot), /Expected one enabled skillar/);
  assert.equal(selectSkillarServer({ skillar: { command: 'new' }, gisul: { command: 'old' } }).name, 'skillar');
  assert.equal(selectSkillarServer({ skillar: { enabled: false }, gisul: { command: 'old' } }).name, 'gisul');
  assert.throws(() => selectSkillarServer({ gisul: { enabled: false } }), /Configure the skillar/);
});
