import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAnalysisConfig } from './daily-improvement.mjs';

const [mode, configFile, output] = process.argv.slice(2);
assert.ok(['--render', '--install'].includes(mode) && configFile && (mode !== '--render' || output), 'Usage: install-improvement-schedule.mjs --render CONFIG PLIST | --install CONFIG');
const config = JSON.parse(await readFile(configFile, 'utf8')); validateAnalysisConfig(config);
assert.ok(typeof config.scheduleHost === 'string' && config.scheduleHost, 'Choose the schedule owner host explicitly');
const repo = fileURLToPath(new URL('..', import.meta.url)), label = 'com.iyendev.dev-tools-daily-improvement';
const logRoot = resolve(config.outputRoot ?? join(repo, 'eval/out/improvement'));
const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const args = [process.execPath, join(repo, 'scripts/daily-improvement.mjs'), resolve(configFile)];
const plist = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array>${args.map(value => `<string>${xml(value)}</string>`).join('')}</array><key>WorkingDirectory</key><string>${xml(repo)}</string><key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(process.env.PATH ?? '/usr/bin:/bin')}</string></dict><key>StartCalendarInterval</key><dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict><key>StandardOutPath</key><string>${xml(join(logRoot, 'schedule.stdout.log'))}</string><key>StandardErrorPath</key><string>${xml(join(logRoot, 'schedule.stderr.log'))}</string></dict></plist>\n`;
const target = mode === '--render' ? resolve(output) : join(homedir(), 'Library/LaunchAgents', `${label}.plist`);
if (mode === '--install') {
  assert.equal(process.platform, 'darwin'); assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, 'Asia/Seoul');
  assert.equal(hostname(), config.scheduleHost, 'Install only on the selected owner host');
}
await mkdir(dirname(target), { recursive: true }); await mkdir(logRoot, { recursive: true, mode: 0o700 });
let previous;
try { previous = await readFile(target, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (previous && previous !== plist) await writeFile(`${target}.backup-${Date.now()}`, previous, { mode: 0o600 });
await writeFile(target, plist, { mode: 0o600 });
if (process.platform === 'darwin') execFileSync('plutil', ['-lint', target], { stdio: 'inherit' });
if (mode === '--install') {
  const domain = `gui/${process.getuid()}`; let loaded = false;
  try { execFileSync('launchctl', ['print', `${domain}/${label}`], { stdio: 'pipe' }); loaded = true; } catch {}
  if (loaded && previous !== plist) { execFileSync('launchctl', ['bootout', `${domain}/${label}`], { stdio: 'pipe' }); loaded = false; }
  execFileSync('launchctl', ['enable', `${domain}/${label}`], { stdio: 'pipe' });
  if (!loaded) execFileSync('launchctl', ['bootstrap', domain, target], { stdio: 'pipe' });
  execFileSync('launchctl', ['print', `${domain}/${label}`], { stdio: 'pipe' });
}
console.log(JSON.stringify({ installed: mode === '--install', target, label, schedule: '09:00 Asia/Seoul', scheduleHost: config.scheduleHost, modelAnalysisEnabled: config.enableModelAnalysis === true }));
