# dev-tools ticket reconciliation: 2026-09-18

Understood as: reconcile the live dev-tools Linear backlog, cancel superseded
work, and implement independent remaining work in separate worktrees while
preserving the active left Herdr pane.

## Scope and ownership

The connected IYEN workspace returned all 35 project issues, IYEN-20 through
IYEN-54, with no next page. All open descriptions, relations and comments were
read; comments were empty at inspection. The 14 already-completed issues retain
their state. The earlier connection failure was resolved through the installed
Linear 5.0.1 plugin and authenticated connector.

The left pane is `w3:p5`. Its completed discovery experiment is commit
`bbc7df6`; it has moved on to `feat/bounded-discovery-evals` and
`feat/bounded-skill-discovery` in the original skills/server checkouts. Its
keywords, ranking, loader and model comparisons remain owned there.
Its 18 development cases do not certify the separate canonical 22-case suite,
four holdouts or ten genuine human ratings. No active files were overwritten.

This work uses `work/linear-triage-20260918` from skills origin/main
`d08320a` and `work/devtools-gisul-trace-20260918` from the local OpenClaw
collector's `2aa1c6b`; its implementation commit is `3970a83`.
The original collector and running Gateway are unchanged.

## Confirmed Linear dispositions

| Issue | Decision and evidence |
| --- | --- |
| IYEN-25 / E03 | Done. Existing Worker/R2 deployment plus fresh installed-client search, load and supporting-file reads succeeded. Unauthenticated and wrong-token requests both returned 401. |
| IYEN-42 / E25 | Done. Reused the existing 검증·배포 대기 state. Changed the team's PR-merge automation from No action to In Review and confirmed persistence after page reload. No test PR was merged. |
| IYEN-46 / E29 | Canceled. SSH child/sshd reconnection acceptance is superseded by the production Worker HTTPS transport. Existing diagnostic/compatibility code is preserved. |
| IYEN-47 / E30 | Canceled. Origin filesystem manifest-cache optimization and its 20% target no longer describe the live immutable Worker/R2 path. No Worker performance gain is claimed. |

Each write was read back. Linear normalizes Markdown links, so confirmation uses
semantic content and the resulting state rather than byte equality.

## Remaining work

| Issue | Implemented or retained; outstanding condition |
| --- | --- |
| IYEN-36 / E14 | Repaired the source completion writer's obsolete SSH prerequisite. September 17's actual Codex audit still fails: 136 production roots, 13 unknown turn identities, one duplicate. The existing laptop job retains write ownership; this repair is not deployed there. |
| IYEN-39–41 / E22–24 | Preserve the active discovery work. Canonical baseline/candidate experiments, fixed scorer, ten genuine human ratings, candidate promotion and required startup comparison remain open. The Macmini global AGENTS is currently empty; the older 4,148-byte baseline cannot be assumed across devices. |
| IYEN-43 / E26 | Existing separated workflow/policy candidate is retained. Canonical L01–08 evaluation and promotion remain open. E25's configuration dependency is now satisfied. |
| IYEN-44 / E27 | Collector and schedule exist. Fresh production audit confirms missing data; three actual qualifying scheduled days remain unproven. Historical backfills do not satisfy this period. |
| IYEN-45 / E28 | Added installed-client snapshot/three-device comparison. Macmini passed collection; Pro/Air access and snapshots, Air installation and evaluation prerequisite remain. Duplicate device names fail the comparison. |
| IYEN-48 / E40 | Added quality-gated, bounded analysis and draft-PR automation with explicit model/host selection, retained invocation receipts and scheduler. Real quality audit blocks model/PR work. No recurring job or model run was installed or claimed; three actual days remain. |
| IYEN-49 / E41 | Keep open. Three human evaluation/promotion cycles and a recorded automation decision cannot be replaced by source tests. |
| IYEN-50 / E42 | Added readiness/login-identity schema, browser flow verifier, example, scoped instructions and candidate adoption skill. Real local fixture detects the interstitial and passes after removal; repeated readiness reuses the same PID in under five seconds. Source awaits review. |
| IYEN-51 / E43 | Keep open pending the selected real project. The template fixture does not establish real-project adoption or reproduce an unavailable historical product commit. |
| IYEN-52 / E44 | Keep open behind the human-loop prerequisite. One host's empty global file does not establish that deletion experiments are obsolete across all hosts. |
| IYEN-53 / E45 | Active left-pane work measures known Korean/English search failures and tests keywords/ranking separately. Do not duplicate it or claim general holdout accuracy from development repair rates. |
| IYEN-54 / E46 | Registered the local stdio bridge with OpenClaw and probed all three tools. Added collector load metadata/canonical turn identity in its separate worktree. Synthetic Langfuse readback passed; collector deployment and a real Gateway turn remain. |

MVP parent IYEN-20 remains open at 13/14 completed children. The short-term parent
has nine non-canceled children after retiring E29/E30; its remaining acceptance
and the medium-term parent remain open.

## Verification and evidence

The skills suite passed 34 tests and validation found 33 valid skills, zero
invalid skills, with existing bilingual-keyword warnings. The OpenClaw collector
passed eight tests. Review fixes received targeted regression checks.
The runtime checks execute Chromium against a local HTTP fixture, validate login
identity independently, preserve fail/pass screenshots and traces, and refuse to
stop or duplicate another/unverified live process.

- Production day report and identifier checkpoint:
  `/Users/iyen/dev-tools/session-notes/linear-triage-20260918-quality/`.
  The overall population was 191 roots, including ten synthetic roots; the
  production gate failed. No dates or unknown records were excluded to pass it.
- Fresh installed Worker probe:
  `/Users/iyen/dev-tools/session-notes/linear-triage-20260918-worker/receipt.json`.
  Content release `20260917.10`, commit
  `e6c7245951993a45cb22e523b5aa49ad450ce172`.
- OpenClaw [synthetic trace](https://jp.cloud.langfuse.com/project/cmu275pqc00i8ad0d79dddjgk/traces/13d7958f5f8e530db3fdb201465a932f):
  actual configured MCP reads followed by synthetic collector input. Explicitly
  `model_run: false`, `gateway_turn: false`.
- Local ignored receipts: `eval/out/devices/`, `eval/out/runtime-tests/`,
  `eval/out/openclaw-gisul/`, and `eval/out/improvement-preflight/`.
  Credentials and raw conversations are not committed.

A blind documentation review identified missing adoption, credential scope,
recovery and schedule-operation details; those were corrected. Evidence and
consistency checks distinguish implemented source, installed configuration,
synthetic execution, real production observations and human judgments.
The project-runtime skill stays outside the live catalog. No second completion
writer, production candidate promotion, recurring analysis or Gateway restart was
performed by this reconciliation.
