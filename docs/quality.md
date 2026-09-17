# Daily collection quality

The source is Langfuse's [Observations API v2](https://langfuse.com/docs/api-and-data-platform/features/observations-api).
It uses cursor pagination and logical roots (`isRootObservation=true`), including
SDK roots with a non-null physical parent. Input/output and expanded run/quality/gisul
metadata are requested explicitly. The older trace API is not required for this job.

```sh
node scripts/langfuse-quality.mjs --date 2026-09-16 --tz Asia/Seoul --project PROJECT_ID
```

Credentials come from `LANGFUSE_CONFIG` or `~/.codex/langfuse-masked.json`. The API
project must exactly match the explicit project ID. Results and cursor checkpoints
go to ignored `eval/out/quality/`; checkpoints contain flags and identifiers, no
prompt/completion bodies or credentials. Exit 0 means the gate passed, 2 means a
complete audit found quality issues, and 1 means collection/configuration failed.

On HTTP 429, rerun the same date after the stored Retry-After deadline. It resumes
the unconsumed cursor and keeps partial results marked incomplete. Do not erase a
checkpoint to claim a clean run. For a deliberate fresh audit of late-arriving data,
use a new `--out` directory and retain the original report for comparison.

Unknown turn identities, empty populations and unfinished calendar days cannot
establish zero duplicates. Synthetic/heartbeat exclusion uses explicit metadata or
tags only. A legacy unmarked test remains in the unknown population. Compare new
and legacy exporter cohorts before attributing a project-wide failure to a change.
The root-observation population differs from historical trace-level input/output
audits; do not directly compare their denominators.

On an Asia/Seoul macOS host, `node scripts/install-quality-schedule.mjs PROJECT_ID`
installs `com.iyendev.langfuse-quality` at 09:00 daily in the user's launchd domain.
It queries the previous completed Korean calendar day. Sleeping/offline machines
may delay execution. A failed date can be resumed explicitly with `--date`.
This job only reads Langfuse; it does not run a model, send messages, create PRs or
promote instructions. Daily model analysis remains a separate evaluation-gated step.

The new workflow and bootstrap are reviewable candidates in `eval/candidates/`.
See [evaluation](../eval/README.md) for promotion conditions. Three consecutive
dated reports must be actual scheduled observations; backfilled dates do not prove
three days of scheduler operation.
