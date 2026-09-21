# Evaluation before promotion

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

Keep baseline/candidate model, tools, fixtures and evaluator fixed. Change one
variable per comparison. Do not promote based on static Markdown validation or
mock unit tests: require no new critical failures, no holdout regression, no missing
ratings, at least baseline total passes and mean cost at most 130% of baseline.
Record judge version and agreement with ten genuine human ratings. Global startup
token comparison requires five identical fresh runs per condition.

Never provide expected outputs or rubric labels to the evaluated agent. Mock tools
may change fixture state but cannot contact Linear or Slack. A lost create response
must be followed by a read before another write. Model runs and results are separate
from deterministic harness tests. No experiment is claimed until it actually ran.
