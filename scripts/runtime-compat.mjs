import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

async function existingFile(path) {
  try {
    assert.ok((await stat(path)).isFile(), `Expected a regular file: ${path}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function selectFile(explicit, primary, legacy) {
  if (explicit !== undefined) {
    assert.ok(typeof explicit === "string" && explicit.length, "Configured file path must be nonempty");
    const path = resolve(explicit);
    assert.ok(await existingFile(path), `Configured file does not exist: ${path}`);
    return path;
  }
  if (await existingFile(primary)) return primary;
  assert.ok(await existingFile(legacy), `Neither ${primary} nor ${legacy} exists`);
  return legacy;
}

export async function selectReleaseConfiguration({ home = homedir(), env = process.env } = {}) {
  const agents = join(home, 'Library/LaunchAgents');
  const configuredLabel = env.SKILLAR_LAUNCHD_LABEL;
  if (configuredLabel !== undefined) assert.match(configuredLabel, /^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use a bare launchd label');
  const primaryLabel = 'com.iyendev.skillar-mcp', legacyLabel = 'com.iyendev.gisul-mcp';
  const plist = await selectFile(
    env.SKILLAR_LAUNCHD_PLIST ?? (configuredLabel ? join(agents, `${configuredLabel}.plist`) : undefined),
    join(agents, `${primaryLabel}.plist`), join(agents, `${legacyLabel}.plist`),
  );
  const inferredLabel = basename(plist, '.plist');
  assert.ok(configuredLabel || [primaryLabel, legacyLabel].includes(inferredLabel), 'Set SKILLAR_LAUNCHD_LABEL for a custom plist');
  const label = configuredLabel ?? inferredLabel;
  const tokenFile = await selectFile(env.SKILLAR_BEARER_TOKEN_FILE ?? env.GISUL_BEARER_TOKEN_FILE,
    join(home, '.config/secrets/skillar-mcp-bearer-token'), join(home, '.config/secrets/gisul-mcp-bearer-token'));
  return { label, plist, tokenFile };
}

export function selectInstalledPlugin(installed, codexRoot, name = 'skillar') {
  for (const candidate of name === 'skillar' ? ['skillar', 'gisul'] : [name]) {
    const matches = installed.filter(item => item.pluginId === `${candidate}@personal` && item.enabled);
    if (!matches.length) continue;
    assert.equal(matches.length, 1, `Expected one enabled ${candidate} plugin`);
    return { ...matches[0], name: candidate, cache: join(codexRoot, 'plugins/cache/personal', candidate, matches[0].version) };
  }
  throw new Error(`No enabled ${name} plugin${name === 'skillar' ? ' or legacy gisul plugin' : ''}`);
}

export function selectSkillarServer(servers) {
  for (const name of ['skillar', 'gisul']) {
    if (servers?.[name] && servers[name].enabled !== false) return { name, config: servers[name] };
  }
  throw new Error('Configure the skillar MCP server (or retain an existing legacy gisul registration)');
}
