export const remoteCalls = turns => turns.flatMap(turn => turn.items ?? []).filter(item => item.type === 'mcpToolCall' && item.server === 'gisul');
export function responseBody(call) {
  const text = call.result?.content?.find(item => item.type === 'text')?.text;
  try { return JSON.parse(text); } catch { return null; }
}

export function validateProvenance(turns, events, expectedCommit, offline = false) {
  if (offline) return { offline: true, verifiedCalls: 0 };
  const operations = { search_skills: 'search', load_skill: 'load_skill', read_skill_file: 'read_skill_file' };
  const remaining = events.filter(event => Object.values(operations).includes(event.event));
  let verifiedCalls = 0;
  for (const call of remoteCalls(turns)) {
    if (call.error || call.status !== 'completed') continue;
    const body = responseBody(call);
    if (!body?.commit || !body.release) throw new Error('Missing release evidence for a completed remote call');
    if (body.commit !== expectedCommit) throw new Error('Content changed during the frozen experiment');
    if (call.tool !== 'search_skills' && !body.manifest_digest) throw new Error('Missing manifest digest');
    const index = remaining.findIndex(event => event.event === operations[call.tool]
      && event.commit === body.commit && event.release === body.release
      && event.connection_id === body.connection_id
      && (call.tool === 'search_skills' || event.uri === call.arguments.uri));
    if (index < 0) throw new Error('Remote response has no matching provenance event');
    const event = remaining.splice(index, 1)[0];
    if (body.manifest_digest && event.manifest_digest !== body.manifest_digest) throw new Error('Manifest digest evidence differs');
    verifiedCalls++;
  }
  if (remaining.length) throw new Error('Unattributed provenance event');
  return { verifiedCalls, commit: expectedCommit };
}

export function failureType(error) {
  const message = String(error);
  if (/Unexpected external capability|Unexpected native skill|Isolation violation/.test(message)) return 'isolation_violation';
  return /exceeded|did not complete/.test(message) ? 'task_incomplete' : 'infrastructure';
}

export function stopCondition(results, maxTokens) {
  if (results.some(result => result.failure?.type === 'isolation_violation')) return 'isolation_violation';
  if (results.filter(result => result.failure?.type === 'infrastructure').length >= 2) return 'two_infrastructure_failures';
  if (results.reduce((sum, result) => sum + (result.usage?.totalTokens ?? 0), 0) >= maxTokens) return 'phase_token_limit';
  return null;
}
