# Automatic discovery experiments

This is an isolated experiment, not production activation. Pin model and
reasoning effort explicitly and hold the reader fixed within each comparison. Candidate skills and
policies remain under `eval/`; no production loader or global AGENTS is edited.

The [completed experiment report](../../docs/automatic-discovery-evaluation-20260918.md)
records 54 comparable task runs, 15 startup probes and four matched-native probes.
Two interrupted attempts and an excluded model-drift continuation remain visible.
No candidate advanced to the canonical holdouts or global activation. The sequence
below is the design; unexecuted promotion steps are not claimed as completed.

The subsequent [bounded-discovery protocol](../../docs/bounded-discovery-work-20260918.md)
tests bilingual metadata, invocation filtering and native-first discovery with a
candidate reader. Its [48-run result](../../docs/bounded-discovery-evaluation-20260918.md)
has separate budgets and runtime identities; do not pool its results with the
initial installed-reader experiment.

## Candidate reader

Pass `--candidate=path/to/descriptor.json` to `run.mjs`, `start.mjs` or
`search-probe.mjs`. The descriptor contains absolute `bundle`, `server` and
`content` paths, plus an optional `sourceCommit`. `bundle` is an immutable copy of
the built public gisul reader, `server` is its built stdio server entry point, and
`content` is a locally verified immutable skill release. Reuse the existing
release builder; do not edit emitted release files.

The adapter connects the actual bundled reader to the actual stdio server. It
does not implement another search algorithm or simulate skill responses. The
protocol records the bundle, server entry point, adapter, release and inventory
hashes and release commit. It also freezes the candidate loader Markdown. Do not
rebuild or replace these paths while a phase is running. Hash-addressed bundle
copies prevent a later build from silently changing an earlier experiment.

Use `--nativeSkills=mandela` only for the separately reported native-present
condition. Matching names do not establish identical content. Local preference,
explicit remote overrides and explicit refusals require separate observations.
This local transport comparison does not replace a live HTTPS Worker canary:
`reader-canary.mjs <output-directory> --bundle=<candidate-bundle>` temporarily
selects a bundle without installing it or changing the global plugin.

## Pre-registered sequence

1. Prove isolation with a fresh app-server: only the candidate gisul loader and
   the read-only gisul MCP tools are enabled. Existing account authentication is
   used in place; HOME and CODEX_HOME are not changed. External apps, browser,
   image generation, hooks, memory and sub-agent tools are disabled for all arms.
2. Freeze the scenario, candidate, reader and installed-model hashes before
   collecting comparative outcomes. Run six pilot cases against baseline,
   description-only and description-plus-selective-policy in rotated order.
   The pilot is one repetition and diagnoses feasibility, not significance.
3. Run viable arms on all 18 discovery development cases. Repeat paired cases
   for the incumbent and a promising alternative. A consistent outcome advantage
   must accompany any extra search cost. Report task families separately;
   Korean/English variants of one family are not independent discoveries.
4. Run the existing 22-case `agent-env-v1` regression suite only after candidate
   freeze. Its four holdouts remain inaccessible to prompt tuning. A test asking
   for a workflow absent from the production catalog remains a visible limitation;
   do not silently install the two old candidate workflows to make it pass.
5. Compare local-duplicate-present versus remote-only conditions separately,
   and perform installed-reader canaries. A mechanism fixture result is not a
   claim about a native production session or general workflow quality.

The pilot has 18 scheduled task runs and a 240-second limit per turn, concurrency
at most two. Stop launching the phase after two infrastructure failures, an
unexpected external capability, or 1.5 million total reported tokens. Inspect the
cause before changing the phase budget. These are experiment limits, not a new
user authorization requirement. A timed-out attempt stays in the results.

The completed exploratory pilot used 838,497 tokens for 18 runs. The first full
development cohort therefore preregisters a 3.3M-token ceiling for 54 runs
(18 cases × three arms), allowing for the additional filesystem-policy context.
Its model, effort, scenarios and candidates remain unchanged. This ceiling is
an execution bound, not a relaxed 130% production cost gate.

## Outcomes and independent checks

Task correctness is primary. Deterministic file/output checks are used when they
can establish the result; a frozen, blinded judge rubric handles semantic review.
The task agent sees only the user prompt and input files. It does not see this
document, scenario labels, expected skill names, judge rubric or candidate name.
The judge receives anonymized results and rubric, not the arm or its hypothesis.

The first two pilot cohorts used prompt separation only, so they are exploratory
and not filesystem-blinded evidence. Version 2 places task workspaces outside the
controller repository. A per-thread named permission profile denies the entire
controller repository, session notes, other scheduled workspaces, disabled skill
bodies and conversation stores. Every trial proves that its loader is readable
and its identity and scenario sources return an actual permission denial. This
profile is passed explicitly to the app-server thread and tool execution; global
configuration and authentication are untouched. MCP has only three reader tools.

Behavior families and reused content families are recorded separately. D01,
D03, D07 and the first turn of D08 reuse one evaluation example; D02, F02 and
the second turn of D08 reuse one HTML fixture. These are condition checks, not
independent samples of task difficulty.

Search/load counts, relevant-skill retrieval, repeated discovery, unused reads,
latency and tokens diagnose the mechanism. An implicit task is not marked wrong
solely because it succeeded without the expected named skill. Explicit skill
requests and explicit no-remote requests do have observable call requirements.
Loading a user-only skill for inspection is recorded separately from applying
its workflow without a user request. Reading a procedure never proves execution.

Every scheduled case and repeat is counted. Critical violations block promotion;
holdout pass rates are compared per case, not hidden in an average. Missing
output, usage or grading prevents a pass. There are no automatic retries. The
interrupted controller's attempts remain in their original ledger and budget;
continuations use new protocols. The development report compares complete paired
blocks and separately reports all interrupted usage. A promotion analysis must
also account for retry costs rather than treating missing attempts as free.
Conditions use rotated execution order to reduce
cache/order bias. The first-turn input comparison gets five fresh runs per arm.

Record input, cached input, cache-write input and total output tokens separately;
reasoning output is already included in output and must not be double-counted.
Use a fixed, dated standard-token-price equivalent for comparison, label it as an
estimate rather than the account bill, and also show uncached-normalized cost.
Do not let incidental cache warmup alone decide the winner.

The existing gate in [../README.md](../README.md) remains authoritative: no new
critical failures, no holdout regression, no missing ratings, at least baseline
passes, mean cost at most 130%, judge version, and agreement with ten genuine
human ratings. Automated direction-finding can finish before those human ratings;
production promotion cannot be claimed until the full gate is satisfied.

## Evidence

Each run saves frozen identities, raw app-server notifications, exact GISUL
release/commit/digest responses, tool calls, final text, edited fixture snapshots,
usage and elapsed time under ignored `eval/out/discovery/`. Synthetic runs are
explicitly tagged if exported to Langfuse. No second daily E14 writer is created.
