import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { langfuseApi } from '../scripts/langfuse-api.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const nano = value => (BigInt(Date.parse(value)) * 1000000n).toString();
const attr = (key, value) => ({ key, value: Array.isArray(value) ? { arrayValue: { values: value.map(x => ({ stringValue: String(x) })) } } : typeof value === 'boolean' ? { boolValue: value } : typeof value === 'number' ? { doubleValue: value } : { stringValue: typeof value === 'string' ? value : JSON.stringify(value) } });
export function experimentSpan(protocol, item, result, datasetId, cohort = null) {
  const traceId = digest(protocol.id + ':' + item.id).slice(0, 32), spanId = digest(traceId + ':root').slice(0, 16);
  const run = { source: 'codex', session_id: result.threadId, turn_id: result.turnId ?? null, synthetic: true, experiment: protocol.id, case_id: item.id, protocol_hash: protocol.hash };
  const gisul = { release: protocol.reader.release, commit: protocol.reader.commit, reader_sha256: protocol.reader.bundleHash, observations: result.gisulEvents.filter(x => x.commit).map(({ event, uri, commit, release, manifest_digest }) => ({ event, uri, commit, release, manifest_digest })) };
  const attributes = {
    'langfuse.environment': 'evaluation', 'langfuse.trace.name': 'agent-env-v1/' + item.id,
    'langfuse.trace.tags': ['synthetic', 'evaluation', 'agent-env-v1'],
    'langfuse.trace.session_id': protocol.id,
    'langfuse.trace.metadata': { synthetic: true, quality: { synthetic: true }, run, gisul },
    'langfuse.observation.type': 'chain',
    'langfuse.observation.input': item.input,
    'langfuse.observation.output': { status: result.status, finalText: result.finalText, files: result.files, grading: result.grading, failure: result.failure, toolCalls: (result.items ?? []).filter(x => ['mcpToolCall', 'dynamicToolCall'].includes(x.type)), mockEvents: result.mockEvents ?? [] },
    'langfuse.observation.metadata': { synthetic: true, quality: { synthetic: true }, run, gisul, usage: result.usage, estimated_cost: result.estimatedCost, cost_kind: protocol.prices.kind, limitations: result.limitations },
    'langfuse.experiment.id': protocol.id, 'langfuse.experiment.name': protocol.id,
    'langfuse.experiment.dataset.id': datasetId,
    'langfuse.experiment.metadata.protocol_hash': protocol.hash,
    'langfuse.experiment.metadata.dataset_version': protocol.dataset.version,
    'langfuse.experiment.metadata.model': protocol.model,
    'langfuse.experiment.metadata.effort': protocol.effort,
    'langfuse.experiment.metadata.profile': protocol.profile,
    'langfuse.experiment.metadata.synthetic': true,
    'langfuse.experiment.metadata.content_commit': protocol.reader.commit,
    'langfuse.experiment.metadata.release': protocol.reader.release,
    'langfuse.experiment.metadata.human_ratings': 0,
    'langfuse.experiment.metadata.promotion': 'not_evaluated',
    'langfuse.experiment.metadata.source_commit': protocol.sourceCommit,
    ...(cohort ? { 'langfuse.experiment.metadata.execution': cohort } : {}),
    'langfuse.experiment.item.id': 'agent-env-v1:' + item.id,
    'langfuse.experiment.item.root_observation_id': spanId,
    'langfuse.experiment.item.expected_output': item.expected,
    'langfuse.experiment.item.metadata.split': item.split,
    'langfuse.experiment.item.metadata.critical': item.critical,
    'langfuse.experiment.description': 'Frozen formal evaluation; observable checks only. Semantic review and genuine human ratings pending. No production promotion.',
  };
  return { traceId, spanId, name: 'formal-evaluation-item', kind: 1, startTimeUnixNano: nano(result.startedAt), endTimeUnixNano: nano(result.endedAt), attributes: Object.entries(attributes).filter(([,value]) => value !== undefined).map(([key,value]) => attr(key,value)), status: { code: result.status === 'completed' ? 1 : 2, ...(result.failure ? { message: result.failure.message } : {}) } };
}

function jsonAttribute(span, key) {
  return JSON.parse(span.attributes.find(x => x.key === key).value.stringValue);
}

export function verifyItem(actual, span, protocol, datasetId) {
  assert.equal(actual?.traceId, span.traceId);
  assert.equal(actual?.id, span.spanId);
  assert.equal(actual?.experimentDatasetId, datasetId);
  assert.equal(actual?.environment, 'evaluation');
  assert.equal(actual?.experimentMetadata?.protocol_hash, protocol.hash);
  for (const [field, attribute] of [['input','langfuse.observation.input'], ['output','langfuse.observation.output'], ['expectedOutput','langfuse.experiment.item.expected_output']]) {
    assert.deepEqual(actual[field], jsonAttribute(span, attribute), 'Remote evidence differs: ' + field);
  }
  for (const [key, expected] of Object.entries(jsonAttribute(span, 'langfuse.observation.metadata'))) assert.deepEqual(actual.metadata?.[key], expected, 'Remote metadata differs: ' + key);
  const execution = span.attributes.find(x => x.key === 'langfuse.experiment.metadata.execution');
  if (execution) assert.deepEqual(actual.experimentMetadata.execution, JSON.parse(execution.value.stringValue), 'Execution completeness differs');
}

export async function exportRun(root, projectId, { api, apply = false, readbackAttempts = 6, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const protocol = JSON.parse(await readFile(join(root, 'protocol.json')));
  if (protocol.preflight) throw new Error('Preflight is not a model experiment');
  const cases = JSON.parse(await readFile(join(root, 'cases.private.json')));
  const phase = JSON.parse(await readFile(join(root, 'phase.json')));
  const summary = JSON.parse(await readFile(join(root, 'summary.json')));
  assert.equal(phase.protocolHash, protocol.hash);
  assert.equal(summary.protocolHash, protocol.hash);
  const { hash: expectedHash, ...body } = protocol;
  assert.equal(digest(JSON.stringify(body)), expectedHash, 'Protocol changed after freeze');
  const results = [], notRun = [];
  for (const slot of phase.runs) {
    if (slot.status === 'not_run') { notRun.push({ caseId: slot.caseId, status: slot.status, reason: phase.stopped ?? 'not_executed' }); continue; }
    if (!['completed','failed'].includes(slot.status)) throw new Error('Experiment has not settled');
    const bytes = await readFile(join(root, 'runs', slot.id, 'result.json'));
    assert.equal(digest(bytes), slot.resultHash, 'Result changed after execution');
    const result = JSON.parse(bytes);
    assert.equal(result.protocolHash, protocol.hash);
    assert.equal(result.caseId, slot.caseId);
    if (!result.threadId || !(result.items?.length || result.usage)) { notRun.push({ caseId: slot.caseId, status: slot.status, reason: 'no_model_execution_evidence' }); continue; }
    results.push(result);
  }
  assert.equal(results.length + notRun.length, cases.length);
  if (!results.length) throw new Error('No actual model executions to export');
  const cohort = { scheduled: cases.length, executed: results.length, completed: results.filter(x => x.status === 'completed').length, failed: results.filter(x => x.status === 'failed').length, notRun, stopReason: phase.stopped ?? null, fullDatasetExecuted: protocol.fullDataset && results.length === protocol.dataset.totalCases, continuation: phase.continuation ?? null };
  if (!apply) return { dryRun: true, experimentId: protocol.id, cases: results.length, projectId, execution: cohort };
  api ??= await langfuseApi();
  const projects = await api.request('/api/public/projects');
  assert.deepEqual(projects.data.map(x => x.id), [projectId], 'Langfuse project mismatch');
  const dataset = await api.request('/api/public/v2/datasets/' + encodeURIComponent(protocol.dataset.name));
  const remote = await api.request('/api/public/dataset-items?' + new URLSearchParams({ datasetName: protocol.dataset.name, limit: '100', page: '1' }));
  assert.ok(remote.meta.totalPages <= 1, 'Unexpected dataset pagination');
  for (const item of cases) {
    const actual = remote.data.find(x => x.id === protocol.dataset.name + ':' + item.id);
    assert.ok(actual && actual.status !== 'ARCHIVED', 'Missing active dataset item: ' + item.id);
    assert.equal(actual.metadata.version, protocol.dataset.version, 'Dataset version mismatch');
    assert.deepEqual(actual.input, item.input); assert.deepEqual(actual.expectedOutput, item.expected);
  }
  const spans = results.map(result => experimentSpan(protocol, cases.find(x => x.id === result.caseId), result, dataset.id, cohort));
  // Deterministic trace/span IDs make timeout reconciliation safe. Re-running
  // export sends the same identities; it never launches another model turn.
  for (let i = 0; i < spans.length; i += 5) {
    const response = await api.request('/api/public/otel/v1/traces', { method: 'POST', body: { resourceSpans: [{ resource: { attributes: [attr('service.name','gisul-formal-eval'),attr('langfuse.environment','evaluation')] }, scopeSpans: [{ scope: { name: 'gisul-formal-eval', version: '1' }, spans: spans.slice(i, i + 5) }] }] } });
    if (Number(response.partialSuccess?.rejectedSpans ?? 0) !== 0 || response.partialSuccess?.errorMessage) throw new Error('OTLP ingestion partly rejected');
  }
  const from = new Date(Math.min(...results.map(x => Date.parse(x.startedAt))) - 60000).toISOString();
  const to = new Date(Math.max(...results.map(x => Date.parse(x.endedAt))) + 60000).toISOString();
  let observed, experiment, lastError;
  for (let attempt = 0; attempt < readbackAttempts; attempt++) {
    if (attempt) {
      const delay = Math.max(5000, lastError?.status === 429 ? Number(lastError.retryAfter ?? 5) * 1000 : 0);
      if (!Number.isFinite(delay) || delay > 60000) break;
      await wait(delay);
    }
    try {
      const runs = await api.request('/api/public/experiments?' + new URLSearchParams({ id: protocol.id, fromStartTime: from, toStartTime: to, fields: 'metadata', limit: '100' }));
      experiment = runs.data.find(x => x.id === protocol.id);
      const data = await api.request('/api/public/experiment-items?' + new URLSearchParams({ experimentId: protocol.id, fromStartTime: from, toStartTime: to, fields: 'io,dataset,metadata,experimentMetadata', limit: '100' }));
      observed = data.data;
      if (data.meta?.cursor) throw new Error('Unexpected experiment pagination');
      assert.equal(experiment?.datasetId, dataset.id);
      assert.equal(experiment.itemCount, results.length);
      assert.equal(observed.length, results.length);
      for (let n = 0; n < results.length; n++) {
        const result = results[n], actual = observed.find(x => x.experimentItemId === protocol.dataset.name + ':' + result.caseId);
        verifyItem(actual, spans[n], protocol, dataset.id);
      }
      lastError = null; break;
    } catch (error) { lastError = error; if (error.status && error.status !== 429) break; }
  }
  if (lastError) throw new Error('Upload sent, readback pending; reconcile the same IDs before retrying: ' + String(lastError));
  const receipt = { checkedAt: new Date().toISOString(), projectId, datasetId: dataset.id, experimentId: protocol.id, protocolHash: protocol.hash, verifiedItems: observed.length, verification: 'identity_io_tool_evidence_grading_usage_provenance', exporterHash: digest(await readFile(fileURLToPath(import.meta.url))), execution: cohort, url: `${api.origin}/project/${projectId}/datasets/${dataset.id}`, items: observed.map(x => ({ itemId: x.experimentItemId, traceId: x.traceId, observationId: x.id })), synthetic: true, humanRatings: 0, promotion: 'not_evaluated' };
  await writeFile(join(root, 'langfuse-receipt.json'), JSON.stringify(receipt,null,2) + '\n', { mode: 0o600 });
  return receipt;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = (await import('node:util')).parseArgs({ options: { run: { type: 'string' }, project: { type: 'string' }, apply: { type: 'boolean', default: false } } });
  if (!values.run || !values.project) throw new Error('Usage: node eval/export.mjs --run DIR --project ID [--apply]');
  console.log(JSON.stringify(await exportRun(resolve(values.run), values.project, { apply: values.apply }),null,2));
}
