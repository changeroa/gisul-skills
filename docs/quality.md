# Daily collection quality

The source is Langfuse's [Observations API v2](https://langfuse.com/docs/api-and-data-platform/features/observations-api). The collector uses cursor pagination and logical roots (`isRootObservation=true`), including SDK roots with a non-null physical parent. Logical roots include tools and subagent lifecycle records as well as turns. Input/output and expanded run/quality/gisul metadata are requested explicitly; the older trace API is not required.

```sh
node scripts/langfuse-quality.mjs --date 2026-09-17 --tz Asia/Seoul --project PROJECT_ID
```

Credentials come from `LANGFUSE_CONFIG` or `~/.codex/langfuse-masked.json`. The API project must exactly match the explicit project ID. Results and cursor checkpoints go to ignored `eval/out/quality/`; checkpoints contain flags and identifiers, no prompt/completion bodies or credentials. Exit 0 means overall quality passed, 2 means a complete audit found quality issues, and 1 means collection/configuration failed.

## Record roles and attribution

Every observation receives one `record_role`. Classification uses these exact observation aliases and types:

| Role | Evidence |
| --- | --- |
| `primary_turn` | `AGENT` named `Codex Turn` or `OpenClaw turn` |
| `tool` | `TOOL`, with no contradictory recognized name or explicit role |
| `subagent_lifecycle` | `AGENT` named `Codex Subagent Started` or `Codex Subagent Finished` |
| `unknown` | Missing/unrecognized evidence or disagreement between role declarations, recognized names and types |

An explicit `metadata.record_role` or `metadata.run.record_role` may declare one of the three known roles for another name. All supplied declarations must agree with each other, any recognized alias, and the required type (`TOOL` for tools, `AGENT` for turns/lifecycle). Unsupported declarations remain unknown. Trace-level `subagent:lifecycle` tags do not exclude actual subagent turns. `runtime_revision` is not an exclusion signal: ordinary tool records carry it too. An unrecognized revision record remains unknown until its role is established.

Producer attribution combines legacy `codex`/`openclaw` tags, every `agent:*` tag and `run.agent_kind`. They must agree on `codex` or `openclaw` and must not contradict a recognized name. A name alone does not supply missing attribution. Unknown or conflicting producers remain visible and block both gates, including when the record has a known non-turn role.

Codex identity uses a nonnegative integer `run.turn_index`, falling back to a nonempty `codex.turn_id`, with a session identifier. OpenClaw identity requires `run.agent_kind=openclaw` and an explicit nonempty `run.turn_id` with a session identifier. Legacy `run_id` and Codex identity fields cannot establish OpenClaw identity: the older collector could generate a random fallback. Historical unknown rows remain unknown.

## Counts and gates

Report version 3 declares `checkpoint_schema: 3` and keeps every fetched root in `counts.roots` and `by_agent`; these are record counts, not turn counts. `primary_turn_roots`, `tool_roots`, `subagent_lifecycle_roots`, `unknown_role_roots` and `by_agent_role` expose the classification. `non_synthetic_primary_turn_roots` and `primary_turns_by_agent` count primary turns after synthetic/heartbeat exclusion, including unfinished turns. Exclusion uses explicit metadata or tags only; unmarked tests remain in scope.

IO rates, metadata checks and identity counts cover completed, non-synthetic, non-heartbeat primary turns. Known tools and lifecycle records do not enter those denominators. Unknown roles block overall quality; unknown roles attributed to Codex or an unknown producer also block E14. Unknown identities, missing input/output/run metadata, unfinished primary turns, empty primary populations and unfinished or partially collected calendar days cannot pass overall quality.

Duplicate checks retain all distinct primary roots. `duplicate_turn_traces` counts extra traces for a producer/session/turn identity; `duplicate_turn_roots` also detects extra roots within the same trace. `multiple_primary_root_traces` flags more than one production primary root in a trace even if they declare different identities. Repeated page observations remain in `repeated_identity_rows` and fail both gates, including when their metadata changed. Revision markers do not excuse these ambiguities.

`aborted`, `interrupted`, `missing_output_aborted` and `missing_output_interrupted` report explicit `codex.aborted`/`codex.interrupted`, quality flags or `run.status` values. A row carrying both flags appears in both diagnostic counts. These counts do not subtract missing output from the quality gate. Expected absence of a final answer remains visible; neither output presence nor a quality pass establishes task success.

`gates.e14_codex_duplicate_free` separately reports the Codex tracing-hook acceptance criterion across the entire completed calendar day. It requires a nonempty completed Codex primary-turn population with known identities and no duplicates, multiple primary roots on a Codex trace, unfinished Codex turns, unknown Codex roles, unattributed/conflicting producers or repeated rows. Actual subagent turns are included. OpenClaw remains in overall quality. E14 does not claim that IO/context quality passed, and root-observation denominators cannot be directly compared with legacy trace-level IO audits.

## Checkpoint retention and replay

Role-aware proof requires checkpoint schema 3. Collection and reporting refuse older schemas or rows missing role/diagnostic fields; they do not invent roles, relabel checkpoints or overwrite retained reports. Keep the original failed evidence and use a new `--out` directory to recollect the **same date**. Old checkpoints cannot serve as schema-3 proof.

The retired Sep17 E14 writer, [mvp-completion.mjs](../scripts/mvp-completion.mjs), intentionally requires schema 2 and must keep refusing schema-3 receipts. Do not revive or loosen that writer, downgrade new checkpoints to bypass it, or replace its historical failed receipt with a new report. [daily-improvement.mjs](../scripts/daily-improvement.mjs) requires schema-3 proof and samples completed production primary turns. Tool and lifecycle volume never increases its sampling weight. Retained analyses using the older sampling contract are refused without another model call; keep their evidence and select a new output directory.

On HTTP 429, rerun the same date after the stored Retry-After deadline. Collection resumes the unconsumed cursor and keeps partial results marked incomplete. For a deliberate fresh audit of late-arriving data, use a new output directory and retain the original for comparison.

The frozen Sep17 E14 failure remains **144 non-synthetic Codex primary turns, 13 unknown identities and one duplicate extra trace**. Sep21's corrected Codex primary-turn count is **135**, replacing the interpretation of 3,808 mixed records as turns; it does not replace Sep17's failed day. In-memory replay of the supplied Sep17–22 archive yields 5,777 roots: 887 primary turns, 4,700 tools and 190 lifecycle records. Of 865 production turns, 15 lack input and 29 lack output, including 16 aborted turns without output. Legacy OpenClaw identities still prevent overall quality from passing; Sep22 is incomplete at the archive's observation time.

Run the portable regression tests with `node --test test/quality.test.mjs`. To include the external frozen evidence, point the optional replay at its unchanged `roots.json` and `summary.json`:

```sh
LANGFUSE_QUALITY_FROZEN_DIR=/path/to/langfuse-linear-review-20260922 \
  node --test test/quality.test.mjs
```

The replay checks the archive digest and supplied per-day counts, adapting its minimized IO flags in memory. It makes no API requests and writes no checkpoints. The archive is a regression baseline, not proof of a live collector, deployment or scheduled execution.

## Daily operation

On an Asia/Seoul macOS host, `node scripts/install-quality-schedule.mjs PROJECT_ID` installs `com.iyendev.langfuse-quality` at 09:00 daily in the user's launchd domain. It queries the previous completed Korean calendar day. Sleeping/offline machines may delay execution. A failed date can be resumed explicitly with `--date`. This job only reads Langfuse; it does not run a model, send messages, create PRs or promote instructions. Daily model analysis remains a separate evaluation-gated step.

The workflow and bootstrap are reviewable candidates in `eval/candidates/`. See [evaluation](../eval/README.md) for promotion conditions. Three consecutive dated reports must be actual scheduled observations; backfilled dates do not prove three days of scheduler operation.

### Verification on 2026-09-22

A manual API audit of Sep21 (Asia/Seoul) completed all 40 pages, including a real
HTTP 429 and successful checkpoint resume. It returned 3,913 logical roots and
225 production primary turns: 135 Codex and 90 OpenClaw. Input omissions and
duplicate turns were zero. Overall quality still failed: three aborted Codex
turns lacked final output and all 90 legacy OpenClaw turns lacked canonical
identity/run metadata. The OpenClaw collector deployment documented in
[OpenClaw gisul](openclaw-gisul.md) affects new turns, not historical records.

The existing 09:00 KST schedule remains on MacBook Pro. This manual audit is not
evidence of three consecutive scheduled executions. Mac mini could reach that
host but SSH authentication was denied, so its job receipts and deployment of
this schema-3 update remain unverified. No replacement job was installed on Mac
mini. IYEN-44 stays open; Sep17's frozen E14 failure is retained independently.
