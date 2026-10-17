# Optional behavioral evaluation

`cases/` is the versioned dataset source. Holdout cases are marked explicitly and
must not be used to tune a candidate. Source traces support the observed failure;
scenario inputs are redacted fixtures, not complete historical replays.

`candidates/bootstrap/AGENTS.md` and `gisul-SKILL.md` are instruction candidates.
`candidates/workflows/skills/` contains linear-delivery, agent-improvement and
project-runtime.
They are not installed globally and are excluded from production release builds.

`node eval/materialize-candidate.mjs` creates an isolated serving tree under
`eval/out/candidate/`. It embeds the canonical `projects/` and `policies/` files as
manifest resources inside linear-delivery; generated copies are not editing
sources. This avoids invalid `../../policies` skill URIs. Load the project index,
then only the matching project and policy. Runtime state names were read from the
team API on 2026-09-17. On September 18, the existing verification state and
PR-merge → In Review setting were confirmed in the team UI after reload;
see [reconciliation evidence](../docs/linear-triage-20260918.md).

Publication policy (2026-09-21): model evaluations and human ratings are optional.
Publishing approved skill changes still requires the validation and integrity workflow.
The guidance below governs claims of evaluation success, not permission to publish.

Keep baseline/candidate model, tools, fixtures and evaluator fixed. Change one
variable per comparison. Do not claim behavioral improvement based on static Markdown validation or
mock unit tests: require no new critical failures, no holdout regression, no missing
ratings, at least baseline total passes and mean cost at most 130% of baseline.
Freeze the same evidence-backed frontier judge and configuration for both
conditions; human ratings are not required. Global startup token comparison
requires five identical fresh runs per condition.

Never provide expected outputs or rubric labels to the evaluated agent. Mock tools
may change fixture state but cannot contact Linear or Slack. A lost create response
must be followed by a read before another write. Model runs and results are separate
from deterministic harness tests. No experiment is claimed until it actually ran.

## Formal runner

`run.mjs` executes this 22-case corpus. It reuses the discovery experiment's
app-server transport, with a separate, temporary `CODEX_HOME` for each case.
`profiles/eval-baseline.config.toml` and `eval-candidate.config.toml` define the
same isolation settings. The runtime adds pinned model, MCP and filesystem
settings to both profile files and records the effective thread configuration.
Only the selected AGENTS text differs. This is an isolated instruction comparison,
not a reproduction of every native plugin on the user's machine.

Create a private reader descriptor with `bundle` (the installed reader artifact),
`bundleHash` (SHA256), `loader` (installed SKILL.md), `pluginVersion`, `endpoint`
(authenticated Worker HTTPS MCP URL), `tokenFile` (local bearer file path),
`commit` and `release`. Never place bearer contents in that file or in the CLI.
The adapter imports the real reader, exposes its three read tools, and pins every
upstream request to the chosen commit. It neither replaces search nor adds the
candidate workflow catalog. A required skill absent from that release stays absent.

Run commands from this repository root after `npm ci`, with a signed-in Codex CLI
and `~/.codex/auth.json` on the same machine. This runner was verified with Codex
0.155.1. Find the plugin root in the enabled gisul plugin's `.mcp.json`; the bundle
is its `runtime/codex.mjs` and loader is `skills/gisul/SKILL.md`. Use that configured
Worker endpoint and bearer file. Take commit/release from a successful installed
reader response or the verified deployment receipt, not a Git branch name.
The descriptor is JSON, with all paths absolute:

```json
{
  "bundle": "/installed/gisul/runtime/codex.mjs",
  "bundleHash": "SHA256_OF_BUNDLE",
  "loader": "/installed/gisul/skills/gisul/SKILL.md",
  "pluginVersion": "INSTALLED_PLUGIN_VERSION",
  "endpoint": "https://YOUR_WORKER/mcp",
  "tokenFile": "/private/gisul/mcp-bearer",
  "commit": "FULL_CONTENT_COMMIT",
  "release": "CONTENT_RELEASE"
}
```

Compute `bundleHash` with `shasum -a 256 /installed/gisul/runtime/codex.mjs`.
Langfuse export reads the existing private `~/.codex/langfuse-masked.json`, or
the path in `LANGFUSE_CONFIG`, with `base_url`, `public_key` and `secret_key`.
`PROJECT_ID` must be the sole project returned for those API keys. The hosted
`agent-env-v1` dataset must match Git: preview `node eval/sync-dataset.mjs --project
PROJECT_ID`, then use `--apply` only for the intended project's dataset. Never
commit these private files. Dataset setup does not execute model trials.

```sh
node eval/run.mjs --out /absolute/new/preflight-directory \
  --reader-config /private/reader.json --profile baseline --preflight
node eval/canary.mjs --out /absolute/new/write-canary \
  --reader-config /private/reader.json
node eval/run.mjs --out /absolute/new/baseline-directory \
  --reader-config /private/reader.json --profile baseline
node eval/export.mjs --run /absolute/new/baseline-directory --project PROJECT_ID
node eval/export.mjs --run /absolute/new/baseline-directory --project PROJECT_ID --apply
```

The default baseline is the local `~/.codex/AGENTS.md`; candidate uses
`candidates/bootstrap/AGENTS.md`. Override those sources with `--baseline-agents`
and `--candidate-agents`. Their bytes, the casebook, model (`gpt-6-astra/max`),
reader and content identity are frozen before execution. Use `--profile candidate`
with the same frozen inputs for a later comparison; do not tune on the four
holdouts. A subset (`--cases N-01`) is a diagnostic run, never a full-suite result.
Before a candidate run, restore both instruction texts from the baseline
`protocol.json`'s `instructions` into private files and pass those paths with the
two instruction flags. Reuse its reader descriptor and source checkout. Compare
`dataset`, `sourceCommit`, `codexVersion`, `model`, `effort`, `fileHashes`,
`instructionHashes`, `loaderMarkdown`, `reader`, `commonInstructions`,
`maxTokens`, `concurrency` and `timeoutMs` in both protocols; differing fields
invalidate a matched comparison. Each profile selects its own frozen instruction
text; run IDs, paths, schedule IDs and timestamps naturally differ.

Before each model turn the runtime verifies the effective configuration, exact
native skill and MCP sets, and actual allowed/denied file reads. The model cannot
read case answers, controller files, credentials or other trial directories.
Real apps, external shell networking, hooks, memory and delegation are disabled.
The controller's authenticated reader can read the pinned Worker release; Linear
and Slack operations terminate at the local mock. L-08 injects a lost response
after a successful create. F-02 lacks a browser fixture, so it cannot prove a live
login-to-editor flow and remains explicitly limited.

The paid write canary must actually create and read back one mock issue before a
full experiment. Shell `approval_policy=never` alone does not authorize MCP writes.
Per-tool `approval_mode=approve` applies only to the exact local mock executable;
external or replacement Linear transports are rejected. The canary has no corpus
answers and is recorded separately from behavioral results and their cost.

Each run allows two concurrent cases, 240 seconds per turn and at most 1.5M
observed tokens before stopping new cases. Any isolation failure or two
infrastructure failures stop launches. Existing output directories are rejected;
there is no automatic model retry. In-flight usage and failures stay in the ledger.
Native provider errors, including model-capacity errors, count as infrastructure
failures and retain their reason. They do not measure the skill's semantic quality.
Token cost is a dated standard API price equivalent, not the account bill. Cache
effects are reported separately. A candidate cost ratio needs a matched completed
comparison; a baseline alone cannot meet the 130% gate.

`score.mjs` records observable checks. Its raw semantic rubrics remain
`unverified`; model review is separate evidence, not a rewrite of those results.
Missing usage or action evidence does not count as a pass. Scoring runs
automatically after each case; inspect `runs/*/result.json` for checks and
`summary.json` for totals. Human ratings remain zero and are not a review gate.

## Frontier semantic review and matched comparison

`frontier-judge.mjs` selects the unique highest score in an explicit capability
policy. Use a refreshed local JSON file or a trusted HTTPS JSON feed before each
new comparison. The policy declares its metric, candidate scope, source version
and UTC `checkedAt`; it is an evidence snapshot, not a universal ranking or a
permanent default model. Names, release dates and provider defaults do not choose
the winner. Scores must compare the exact model and effort configurations under
the same capability metric, rather than cost. A later, higher-scoring verified
configuration wins without editing the resolver.

Policy structure, with illustrative values to replace from the selected source:

```json
{
  "schema": 1,
  "version": "SOURCE_SNAPSHOT_VERSION",
  "metric": "NAMED_CAPABILITY_METRIC",
  "scope": "VERIFIED_CALLABLE_EXACT_CONFIGURATIONS",
  "checkedAt": "2026-10-17T00:00:00.000Z",
  "source": {
    "url": "https://rankings.example/capability",
    "version": "SOURCE_METRIC_VERSION"
  },
  "candidates": [
    {
      "id": "SOURCE_ROW_ID",
      "provider": "openai",
      "transport": "codex-cli",
      "model": "EXACT_PROVIDER_MODEL_ID",
      "effort": "EXACT_SOURCE_EFFORT",
      "score": 0,
      "fallback": false,
      "evidenceUrl": "https://rankings.example/capability/model"
    }
  ]
}
```

Supported routes are `openai`/`codex-cli` and `anthropic`/`claude-cli`, using the
installed, authenticated subscription CLI. Add every configuration covered by
the declared comparison scope. A tied top score, malformed policy, unavailable
winner, unsupported effort or visibly rerouted response fails; the adapter never
silently chooses a weaker model. Evidence URLs are public HTTPS URLs without
credentials or query parameters. The selected policy, exact profile and hashes
are frozen together; do not refresh a selection halfway through a pair.

```sh
node eval/frontier-judge.mjs --policy /private/frontier-policy.json \
  --out /private/frozen-frontier-selection.json
node eval/semantic-assessment.mjs --run /absolute/new/baseline-directory \
  --selection /private/frozen-frontier-selection.json
node eval/semantic-assessment.mjs --run /absolute/new/baseline-directory \
  --selection /private/frozen-frontier-selection.json --apply
node eval/semantic-assessment.mjs --run /absolute/new/candidate-directory \
  --selection /private/frozen-frontier-selection.json --apply
node eval/semantic-assessment.mjs --compare \
  --baseline /absolute/new/baseline-directory \
  --candidate /absolute/new/candidate-directory
```

Without `--apply`, assessment validates and previews without calling a model.
Importing these modules, exporting a run, comparing results and ordinary tests
never start a judge. Selection and review files are exclusive writes.

Live judgments use only the supplied task, rubric and frozen response as data.
Codex uses a private auth copy/workspace and a named permission profile denying
all tool filesystem and network access. Claude uses restricted safe mode with
empty tools, MCP servers and inherited settings. Session persistence, hooks,
apps, delegation and search are disabled where supplied by the transport.
Interrupting the CLI stops its owned model process and removes its auth copy.

`semantic-assessment.json` binds every verdict and exact cited response quote to
the protocol, casebook, expected contract, result bytes and actual prompt hash.
It records the selection, requested model/effort, CLI version and adapter/source
hashes. Provider-reported model identity is retained when available and must
match the request. Codex also verifies the requested profile against its live
catalog; Claude requires a matching `modelUsage` report. An independently
attested provider weight revision is not available from these CLI contracts.
`fail`, `abstain` and missing evidence remain distinct from passing review.

Private `judge-attempts/SELECTION_HASH/PROMPT_HASH/receipt.json` records a started
request before inference, then its completed response hash or failure. A matching
completed response can be reused; failed, incomplete or ambiguous attempts never
trigger an implicit paid retry. Original receipts remain available for inspection.
A new explicit experiment/review directory is needed after changing inputs or
the evaluator; existing evidence is not overwritten.

Comparison is read-only and requires both full settled casebooks, all 13 frozen
controls above, the same price basis and the same selection/model/effort/CLI/
adapter/assessment implementation. Diagnostic fixture judges, harness defects,
missing usage/cost or unverified judgments cannot qualify. It checks new critical
failures, holdout and total passes, and mean recorded execution cost against 130%
of baseline. Costs include every actual ledger result, including continuation
results, not just the last phase summary. A zero baseline cost produces a null
ratio; the known means still determine the cost bound.

The comparison exits 0 when eligible, 2 when evidence does not qualify, and 1 for
invalid CLI usage. `eligible` describes the matched evidence, not permission to
promote or publish; `promotion` stays `not_evaluated`.

`export.mjs` validates the hosted dataset and
project before using the supported OpenTelemetry experiment attributes. Stable
trace/span IDs support upload reconciliation without running the model again.
Before ingestion, the exporter reads back existing items and records upload intent
for new batches. A retry only verifies already-submitted batches; it never resends
an ambiguous upload. Retain the intent file and investigate missing records.
It verifies every experiment item's identity and actual output by readback.
Readback also compares input, expected output, files, tool/mock evidence, grading,
usage and release metadata. Stopped runs can be exported as explicitly partial
experiments: unexecuted and no-model failures are recorded as missing cases and
never fabricated as model traces.
Optional semantic review is projected alongside the unchanged raw grading.
Create it before `langfuse-upload-intent.json`: review writers share the export
lock and refuse changes after upload intent freezes the payload. Readback checks
the exact review digest and per-case result bindings; legacy exports without
review remain supported.
If execution reveals a harness defect, retain the frozen results and add a
separate `assessment.json` with `status: "diagnostic_invalid_for_behavior"` and
the reason before export. The experiment records this assessment and its hash;
it is not eligible for a behavioral comparison. Corrected runs get new protocols.
All exported traces are synthetic and use the `evaluation` environment. They are
excluded from production primary-turn metrics, while raw duplicate/revision
checks still retain them. Evaluation exports cannot prove a zero-duplicate day.
No scheduler or global setting is installed by the runner.

After reviewing a token-stopped run's actual cost, an explicit
`node eval/continue.mjs --run DIR` permits one further phase of at most 600k
observed tokens. It selects only `not_run` cases, preserves the initial ledger
and summary, imports and re-verifies the original frozen execution code, and
records a separate immutable continuation protocol. Completed or failed cases
are never retried. The final experiment records both phases and their total cost;
the extra budget is not a relaxation of a candidate promotion gate. Other stop
reasons and already-started continuations are rejected.

Contracts: [Codex profile files](https://learn.chatgpt.com/docs/config-file/config-reference),
[Langfuse experiment attributes](https://langfuse.com/integrations/native/opentelemetry/experiments),
[dated model price source](https://developers.openai.com/api/docs/models/gpt-6-astra).
