import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { inspectInstalled, isolatedConfig, readyServers, sha256 } from './environment.mjs';
import { CodexSession } from './codex-session.mjs';
import { configureCandidate } from './candidate-config.mjs';

// A diagnostic query set, not a held-out measure of task quality or ranker superiority.
// Exact names are positive controls. User-language paraphrases test lexical coverage.
const groups = [
  { intent: 'evaluation-validity', relevant: 'mandela', queries: ['mandela', 'eval', 'evaluation', '평가', '평가 설계', 'answer leakage'] },
  { intent: 'usability-review', relevant: 'dont-make-me-think', queries: ['dont-make-me-think', 'usability', 'UI', 'UX', '사용성', '버튼 문구'] },
  { intent: 'documentation-cleanup', relevant: 'detool', queries: ['detool', 'documentation', 'user documentation', '문서', '내부 용어'] },
  { intent: 'explicit-adversarial-review', relevant: 'hate', queries: ['hate', 'plan', 'critical review', '계획 검토'] },
  { intent: 'unrelated-negative', relevant: null, queries: ['391', 'null empty string', 'helo typo', '기술 뜻', 'nonexistent-skill-7c9e'] },
];
const options = Object.fromEntries(process.argv.slice(3).map(arg => { const [key, ...rest] = arg.replace(/^--/, '').split('='); return [key, rest.join('=')]; }));
const out = resolve(process.argv[2] ?? 'eval/out/discovery/search-probe-20260918');
await mkdir(out, { recursive: true });
const installed = await inspectInstalled(process.cwd());
if (options.candidate) await configureCandidate(installed, options.candidate);
const api = new CodexSession({ cwd: out, config: isolatedConfig(installed, join(out, 'events')) });
const results = [];
try {
  await api.initialize(); await api.start(out); await readyServers(api);
  for (const group of groups) for (const query of group.queries) {
    const started = Date.now();
    const response = await api.rpc('mcpServer/tool/call', { threadId: api.threadId, server: 'gisul', tool: 'search_skills', arguments: { query, limit: 50, ...(options.mode ? { mode: options.mode } : {}) } });
    assert.ok(!response.isError);
    const body = JSON.parse(response.content.find(item => item.type === 'text').text);
    const names = body.skills.map(skill => skill.name);
    results.push({ intent: group.intent, query, relevant: group.relevant, names, found: group.relevant ? names.includes(group.relevant) : null,
      rank: group.relevant && names.includes(group.relevant) ? names.indexOf(group.relevant) + 1 : null,
      invocation: body.skills.map(skill => ({ name: skill.name, invocation: skill.invocation ?? null })),
      commit: body.commit, release: body.release, elapsedMs: Date.now() - started });
  }
  assert.equal(new Set(results.map(result => result.commit)).size, 1, 'Catalog changed during query probe');
  await writeFile(join(out, 'results.json'), JSON.stringify({ synthetic: true, diagnosticOnly: true, mode: options.mode ?? 'legacy', candidate: installed.candidate ?? null,
    queryHash: sha256(JSON.stringify(groups)), runtimeHash: installed.runtimeHash, results }, null, 2) + '\n');
  console.log(JSON.stringify({ queries: results.length, found: results.filter(row => row.found).length,
    topFive: results.filter(row => row.rank && row.rank <= 5).length,
    unrelatedMatches: results.filter(row => row.relevant === null).reduce((sum, row) => sum + row.names.length, 0) }));
} finally { await api.close(); }
