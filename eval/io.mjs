import { createWriteStream } from 'node:fs';
import { statfs } from 'node:fs/promises';
import { finished } from 'node:stream/promises';

export async function requireDiskSpace(path, readStats = statfs) {
  const stats = await readStats(path);
  const availableBytes = Number(stats.bavail) * Number(stats.bsize);
  if (!Number.isFinite(availableBytes) || availableBytes < 512 * 1024 * 1024) {
    const error = new Error('Evaluation requires at least 512 MiB free before starting a paid trial');
    error.code = 'EVAL_DISK_SPACE';
    error.availableBytes = availableBytes;
    throw error;
  }
  return availableBytes;
}

export function eventJournal(path, onFailure, factory = createWriteStream) {
  const stream = factory(path, { mode: 0o600 });
  let failure;
  stream.on('error', error => {
    failure ??= error;
    onFailure(error);
  });
  // Attach rejection handling immediately, including failures before close().
  const settled = finished(stream).then(() => null, error => error);
  return {
    write(event) {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => stream.write(JSON.stringify(event) + '\n', error => error ? reject(error) : resolve()));
    },
    async close() {
      if (!stream.destroyed) stream.end();
      const error = await settled;
      if (error) throw error;
    },
  };
}
