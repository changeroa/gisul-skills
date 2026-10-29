import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './environment.mjs';

export async function configureCandidate(installed, descriptorPath) {
  const descriptor = JSON.parse(await readFile(resolve(descriptorPath)));
  for (const key of ['bundle', 'server', 'content']) {
    if (!descriptor[key] || !descriptor[key].startsWith('/')) throw new Error('Candidate paths must be absolute: ' + key);
  }
  const wrapper = join(dirname(fileURLToPath(import.meta.url)), 'candidate-reader.mjs');
  const hashes = {};
  for (const [name, path] of Object.entries({ bundle: descriptor.bundle, server: descriptor.server, adapter: wrapper,
    inventory: join(descriptor.content, 'inventory.json'), release: join(descriptor.content, 'release.json') })) hashes[name] = sha256(await readFile(path));
  const release = JSON.parse(await readFile(join(descriptor.content, 'release.json')));
  installed.runtimeHash = hashes.bundle;
  installed.candidate = { ...descriptor, hashes, commit: release.commit, release: release.release, production: false };
  installed.mcp = { command: process.execPath, args: [wrapper, '--bundle=' + descriptor.bundle, '--server=' + descriptor.server, '--content=' + descriptor.content], cwd: descriptor.content };
  return installed;
}
