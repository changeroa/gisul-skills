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
Record judge version and agreement with ten genuine human ratings. Global startup
token comparison requires five identical fresh runs per condition.

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

```sh
node eval/run.mjs --out /absolute/new/preflight-directory \
  --reader-config /private/reader.json --profile baseline --preflight
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

Before each model turn the runtime verifies the effective configuration, exact
native skill and MCP sets, and actual allowed/denied file reads. The model cannot
read case answers, controller files, credentials or other trial directories.
Real apps, external shell networking, hooks, memory and delegation are disabled.
The controller's authenticated reader can read the pinned Worker release; Linear
and Slack operations terminate at the local mock. L-08 injects a lost response
after a successful create. F-02 lacks a browser fixture, so it cannot prove a live
login-to-editor flow and remains explicitly limited.

Each run allows two concurrent cases, 240 seconds per turn and at most 1.5M
observed tokens before stopping new cases. Any isolation failure or two
infrastructure failures stop launches. Existing output directories are rejected;
there is no automatic model retry. In-flight usage and failures stay in the ledger.
Token cost is a dated standard API price equivalent, not the account bill. Cache
effects are reported separately. A candidate cost ratio needs a matched completed
comparison; a baseline alone cannot meet the 130% gate.

`score.mjs` records observable checks. Semantic rubrics remain `unverified` and
human ratings remain zero until real review occurs. Missing usage or action
evidence does not count as a pass. `export.mjs` validates the hosted dataset and
project before using the supported OpenTelemetry experiment attributes. Stable
trace/span IDs support upload reconciliation without running the model again.
It verifies every experiment item's identity and actual output by readback.
All exported traces are synthetic and use the `evaluation` environment; they are
excluded from production daily quality evidence. No scheduler or global setting
is installed by the runner.

Contracts: [Codex profile files](https://learn.chatgpt.com/docs/config-file/config-reference),
[Langfuse experiment attributes](https://langfuse.com/integrations/native/opentelemetry/experiments),
[dated model price source](https://developers.openai.com/api/docs/models/gpt-6-astra).
