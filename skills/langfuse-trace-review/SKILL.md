---
name: langfuse-trace-review
description: Langfuse 트레이스·observation을 실제 조회해 요청, 응답, 도구 결과와 표본 범위를 검증한다. Use for trace inspection, failure investigation, and scheduled reviews through an already connected Langfuse reader.
---

# Langfuse trace review

Use the connected project reader. Inspect its actual tools before claiming access is unavailable. An exporter only uploads telemetry; its health does not prove read access. Keep working credentials and the selected model/runtime unchanged unless the failure demonstrates a problem there.

## Read a trace

1. Establish the requested time interval and timezone. Discover the observation field schema once per review before choosing explicit fields. Reuse that schema and reject unsupported projections locally. A field returned in a response, such as `url`, need not be a valid requested field. REST field groups such as `core` are not MCP observation field names.
2. Start with a small compact `listObservations` request, an explicit limit (typically 3–5 for selecting one trace), and a bounded interval. Use returned trace/observation IDs. Discover names or metadata keys before filtering on them; do not guess spellings such as `OpenClawTurn`. Inspect `type`, name, tags, and provenance to locate the relevant AGENT turn and verify the requested agent/environment. A Codex trace is not an OpenClaw trace merely because OpenClaw retrieved it. If identity is unverified, keep searching within scope or report that gap. Logical roots can include tools with physical parents, so root status alone does not identify a user request.
3. Pass the selected **traceId** to `listObservations` to inspect that trace's observations. Pass an actual **observationId** to `getObservation`. One observation is not the whole trace. For a task outcome, read the AGENT turn's input/output and relevant tool evidence, including later verification, before deciding what happened.
4. Compact defaults omit payloads. Request supported input/output/status/metadata fields explicitly for the selected records. Sensitive projections require a trace ID, exact observation-ID filter, or both interval boundaries within the server's supported window. Date-scoped input/output requests may have a lower limit; follow the current schema. Explicit metadata values can be truncated unless the necessary keys are included in `expandMetadataKeys`; expand the relevant provenance keys before relying on them.
5. Preserve pagination evidence. A remaining opaque cursor means more matching observations exist. Follow it for complete requested coverage, or report the inspected sample and remaining interval/cursor when a real limit prevents completion. Reserve enough of a bounded call budget for detail reads instead of spending it all on lists.

For a single-trace request, finish once the requested detail is verified. Do not expand it into a period-wide audit. For a scheduled review, distinguish synthetic/eval traffic, automation, aborted turns, lifecycle events, and actual user tasks before aggregating results.

## Recover from an error

- **Unsupported field / invalid arguments:** inspect the relevant field or filter schema, correct the arguments, then make one corrected request. Do not repeat the same invalid request or send more parallel calls with it.
- **OpenClaw `paused after repeated tool failures`:** this is a local MCP cooldown, not proof of Langfuse rate limiting or bad credentials. Stop data calls until the reported retry time, use the wait to correct the failed request, then make one corrected read. Preserve unfinished coverage if the run cannot wait.
- **HTTP 429:** respect the actual `Retry-After` response. Keep the current cursor and scope; do not relabel the response as an authentication failure.
- **Authentication, transport, or missing tools:** report the observed error and affected runtime. Use the configured client's probe or active-session tool catalog to distinguish registration, connection, and agent projection. A successful standalone probe does not prove that an older session has the same tools. Avoid blind restarts and repeated identical failures.

## Ground the result

Report the requested scope, what was actually read, and what remains unverified. A successful tool call proves retrieval, not task success. A WARNING or incidental command failure is not sufficient evidence of a failed user task. Link a failure to a required step and inspect later recovery. Later verification of one error must not hide a different unresolved mandatory failure.

Prefer a returned valid trace URL. If constructing one, use the connected origin and the **returned projectId and traceId** with `/project/{projectId}/traces/{traceId}`; add only an observation ID verified to belong to that trace. Do not substitute a trace ID for a project ID. Report relevant facts without dumping complete private payloads or credentials.

Current upstream contracts: [Langfuse MCP reference](https://mcp.reference.langfuse.com/) and [OpenClaw MCP troubleshooting](https://docs.openclaw.ai/tools/mcp). Live advertised schemas take precedence over remembered field lists.
