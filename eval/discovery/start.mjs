import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep an explicitly requested long evaluation alive across interactive UI turns.
// The PID and append-only log are always reviewable; SIGTERM stops new slots.
const args = process.argv.slice(2);
const outArg = args.find(arg => arg.startsWith('--out='));
if (!outArg) throw new Error('An explicit --out path is required');
const root = resolve(outArg.slice('--out='.length));
await mkdir(root, { recursive: true });
const fd = openSync(join(root, 'controller.log'), 'a', 0o600);
const child = spawn(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'run.mjs'), ...args], { cwd: process.cwd(), detached: true, stdio: ['ignore', fd, fd], env: process.env });
await writeFile(join(root, 'controller.json'), JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString(), args, cwd: process.cwd() }, null, 2) + '\n');
child.unref(); closeSync(fd);
console.log(JSON.stringify({ pid: child.pid, root, log: join(root, 'controller.log') }));
