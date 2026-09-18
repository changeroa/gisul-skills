import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { cost } from './run.mjs';

// Explicit recovery only. Never silently relabel an abandoned slot as passed.
const root = resolve(process.argv[2]);
const ledger = JSON.parse(await readFile(join(root, 'phase.json'), 'utf8'));
const archived = join(root, 'phase.before-recovery-' + Date.now() + '.json');
await writeFile(archived, JSON.stringify(ledger, null, 2) + '\n');
for (const slot of ledger.runs.filter(slot => slot.status === 'running')) {
  const dir = join(root, 'runs', slot.id);
  const existing = await readFile(join(dir, 'result.json'), 'utf8').then(JSON.parse).catch(() => null);
  if (existing) { slot.status = existing.status; continue; }
  const identity = await readFile(join(dir, 'identity.json'), 'utf8').then(JSON.parse).catch(() => slot);
  const raw = await readFile(join(dir, 'events.jsonl'), 'utf8').catch(() => '');
  const events = raw.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
  const usage = events.filter(event => event.method === 'thread/tokenUsage/updated').at(-1)?.params.tokenUsage.total ?? null;
  const result = { ...identity, status: 'interrupted', failure: { type: 'controller_interrupted', message: 'Controller exited without a final receipt; preserved observed usage is a lower bound.' }, usage, usagePartial: true, missingUsage: true, estimatedCost: cost(usage), normalizedCost: cost(usage, true), turns: [], gisulEvents: [], files: {}, recoveredAt: new Date().toISOString() };
  // A running ledger slot can precede directory creation.
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'result.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  slot.status = 'interrupted'; slot.failure = result.failure;
  ledger.usedTokens += usage?.totalTokens ?? 0;
}
for (const slot of ledger.runs) if (slot.status === 'pending') slot.status = 'not_run';
ledger.stopReason = 'controller_interrupted';
ledger.recovery = { at: new Date().toISOString(), knownUsageOnly: true, previousLedger: archived };
await writeFile(join(root, 'phase.json'), JSON.stringify(ledger, null, 2) + '\n');
console.log(JSON.stringify({ completed: ledger.completed, usedTokensLowerBound: ledger.usedTokens, interrupted: ledger.runs.filter(slot=>slot.status==='interrupted').length, notRun: ledger.runs.filter(slot=>slot.status==='not_run').length }));
