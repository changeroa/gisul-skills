import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { CodexSession } from './codex-session.mjs';

export const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function inspectInstalled(cwd) {
  const api = new CodexSession({ cwd });
  try {
    const host = await api.initialize();
    const { config } = await api.rpc('config/read', { cwd, includeLayers: false });
    const listed = await api.rpc('skills/list', { cwds: [cwd], forceReload: true });
    const skills = listed.data.flatMap(entry => entry.skills);
    const loader = skills.find(skill => skill.name === 'gisul:gisul');
    if (!loader) throw new Error('Installed gisul plugin loader not found');
    const pluginRoot = resolve(dirname(loader.path), '../..');
    const manifest = JSON.parse(await readFile(join(pluginRoot, '.mcp.json'), 'utf8'));
    const source = manifest.mcpServers.gisul;
    const loaderMarkdown = await readFile(loader.path, 'utf8');
    const runtime = resolve(pluginRoot, source.args[0]);
    return {
      host, model: config.model, effort: config.model_reasoning_effort,
      serviceTier: config.service_tier ?? null,
      skills: skills.map(({ name, path, enabled, scope }) => ({ name, path, enabled, scope })),
      pluginIds: Object.keys(config.plugins ?? {}), mcpNames: Object.keys(config.mcp_servers ?? {}),
      loaderPath: loader.path, loaderMarkdown, loaderHash: sha256(loaderMarkdown),
      runtimeHash: sha256(await readFile(runtime)),
      mcp: { command: source.command, args: [runtime, ...source.args.slice(1)], cwd: pluginRoot },
    };
  } finally { await api.close(); }
}

export function isolatedConfig(installed, eventDir, { nativeSkills = [], mcp = installed.mcp, deniedPaths = [] } = {}) {
  const config = {
    model: installed.model, model_reasoning_effort: installed.effort,
    approval_policy: 'never', sandbox_mode: 'workspace-write',
    'sandbox_workspace_write.network_access': false,
    'features.hooks': false, 'features.plugin_hooks': false,
    'features.plugins': false, 'features.remote_plugin': false,
    'features.apps': false, 'features.browser_use': false, 'features.in_app_browser': false,
    'features.computer_use': false, 'features.image_generation': false,
    'features.skill_mcp_dependency_install': false,
    'features.memories': false, 'features.multi_agent': false, 'features.multi_agent_v2': false,
    'apps._default.enabled': false, web_search: 'disabled',
    'shell_environment_policy.inherit': 'core',
    'skills.config': installed.skills.map(skill => ({ path: skill.path, enabled: nativeSkills.includes(skill.name) })),
  };
  config.plugins = Object.fromEntries(installed.pluginIds.map(id => [id, { enabled: false }]));
  for (const name of installed.mcpNames) {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('Unsupported MCP config key');
    config['mcp_servers.' + name + '.enabled'] = false;
  }
  config['mcp_servers.gisul'] = { ...mcp, enabled: true, startup_timeout_sec: 30, tool_timeout_sec: 30, env: { GISUL_EVENT_LOG_DIR: eventDir } };
  if (deniedPaths.length) config['permissions.discovery'] = {
    extends: ':workspace',
    filesystem: Object.fromEntries(deniedPaths.map(path => [path, 'deny'])),
    network: { enabled: false },
  };
  return config;
}

// This command runs under the same named filesystem policy as task tool calls.
// No prompt or model tokens are involved in the canary.
export async function verifyReadBoundary(api, workspace, allowedPath, deniedPaths) {
  const checks = [];
  for (const path of [allowedPath, ...deniedPaths]) {
    const result = await api.rpc('command/exec', {
      command: ['/bin/cat', path], cwd: workspace, permissionProfile: 'discovery',
      timeoutMs: 10000, outputBytesCap: 1000,
    });
    const allowed = path === allowedPath;
    const passed = allowed ? result.exitCode === 0 : result.exitCode !== 0 && result.stdout === '' && /not permitted|Permission denied/i.test(result.stderr);
    checks.push({ path, allowed, passed, exitCode: result.exitCode });
    if (!passed) throw new Error('Isolation violation: filesystem boundary canary failed');
  }
  return checks;
}

export async function writeLoader(workspace, markdown) {
  const root = join(workspace, '.agents/skills/gisul');
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'SKILL.md'), markdown);
  return join(root, 'SKILL.md');
}

export async function readyServers(api, allowed = ['gisul'], timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs;
  let servers = [];
  do {
    const page = await api.rpc('mcpServerStatus/list', { threadId: api.threadId, limit: 100 });
    if (page.nextCursor) throw new Error('Unexpected MCP pagination in isolated environment');
    servers = page.data;
    const connected = servers.filter(server => server.runtimeStatus === 'connected');
    if (connected.some(server => !allowed.includes(server.name))) throw new Error('Unexpected external capability: ' + connected.map(server => server.name).join(','));
    if (allowed.every(name => connected.some(server => server.name === name))) return connected;
    await new Promise(resolve => setTimeout(resolve, 500));
  } while (Date.now() < deadline);
  throw new Error('MCP startup incomplete: ' + JSON.stringify(servers.map(({ name, runtimeStatus }) => ({ name, runtimeStatus }))));
}
