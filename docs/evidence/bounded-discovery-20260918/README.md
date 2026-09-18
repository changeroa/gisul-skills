# Bounded discovery evidence

Read the [result and decision](../../bounded-discovery-evaluation-20260918.md) and
[pre-registered protocol](../../bounded-discovery-work-20260918.md) first.

`remote-v1/` contains 36 task attempts across the pilot and expansion.
`native-v2/` contains 12 attempts with the native mandela skill available. These
cohorts use different reader hashes and must not be pooled into one comparison.
Each `comparison.json` retains frozen protocols, every scheduled slot, identities,
usage and provisional ratings. `completions.json` retains final answers, actions
and final fixture files; private reasoning events remain in ignored raw receipts.
`grading.json` records the judge version, source/input hashes and every rating.
Human ratings are null. `grader.mjs` preserves the exact grading source.

The protocol maps original harness filenames to SHA256-named source snapshots
under `frozen-harness/`. Candidate Markdown is embedded in each frozen protocol;
`baseline-loader.md` preserves the installed baseline bytes. Reproduce the reader
from the source commits and dependency locks named in the report, rebuild the
verified content commit with the existing release builder, then use an immutable
bundle path in the descriptor described in [the runner guide](../../../eval/discovery/README.md).
Do not use a subsequently rebuilt path as an earlier cohort's runtime.

`search/` separates metadata changes from ranking and invocation filtering across
the same 26 known development queries. It is a repair diagnostic, not a holdout.
`base-content-proof.json` compares old emitted content with Git and the current
production content identity. `live-reader-v1.json` and `live-reader-v2.json` use the
real authenticated Worker; the latter also passes an explicit commit through the
loads and retains the supporting file's load ID.

`mechanisms.json` records calls, query arguments and native reads across all 48
tasks. `budget.json` counts task and judge usage separately. `verification.json`
records deterministic checks, CI, the unchanged installed runtime and the blocked
behavioral publication gate. None of these records authorizes global activation.
