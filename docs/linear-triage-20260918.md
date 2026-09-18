# dev-tools ticket reconciliation

Understood as: inspect the current dev-tools Linear backlog, cancel superseded work, and implement remaining independent work in a separate worktree after reading the active left Herdr pane.

## Ownership and evidence

The left pane is `w3:p5`, confirmed by Herdr's neighbor lookup on 2026-09-18.
It owns `feat/automatic-discovery-evals` in `/Users/iyen/dev-tools/gisul-skills`,
including the discovery experiment and its loader candidates. This worktree uses
`work/linear-triage-20260918` from `origin/main` at `d08320a`. It does not edit the
left pane's checkout, configuration, or experiment files.

The current session's installed connector returned `Unknown tool` for
`linear.list_issues`. Linear has not been changed. The items below are provisional
reconciliation findings from source and retained evidence; they are not a current
Linear inventory or confirmed ticket dispositions.

## Findings

| Existing work | Evidence and next action |
| --- | --- |
| E-03 / IYEN-25, Worker HTTPS transition | [Deployment evidence](worker-r2-deployment-20260917.md) records direct Worker/R2 serving, authenticated installed-client reads, publication and recovery. Read the current ticket before recording completion. SSH sleep/wake acceptance was superseded by the 2026-09-17 transport change. |
| E-14 / IYEN-36, completed-day duplicate audit | The fresh September 17 audit fails: 136 Codex production roots, 13 unknown turn identities and one duplicate turn trace. Keep the ticket unresolved. The existing laptop job owns completion writes. |
| IYEN-20, MVP parent | Requery all children and the current acceptance before closing. A stale local sleep receipt must not prevent recognizing an E-03 completion recorded separately in Linear. |
| E-22–24, E-26, E-45, evaluation and discovery | The left pane's discovery experiment overlaps this work. Preserve that implementation and keep behavioral promotion dependent on actual evaluation and required human ratings. |
| E-27, daily quality | Collector and scheduler exist. Three real scheduled days remain a separate observation requirement; backfilled reports cannot establish it. |
| E-29–30, SSH reconnection and origin manifest performance | Reassess against Worker/R2 production. Do not implement or cancel from the old architecture alone: check current consumers and ticket scope first. |
| E-28 and E-40–46, device rollout and later work | Live ticket scope, dependencies and existing implementations still need reconciliation. Do not treat old PRD dates as cancellation evidence. |

## Independent repair

The previous bounded MVP completion script read the superseded SSH sleep log before it could verify E-14 and required a local E-03 receipt before checking the parent. The repair removes the old SSH acceptance transformation, leaves E-03 completion to the Worker verification flow and checks the current Linear child states before closing the parent. E-14 evidence, fingerprint, dependency, project and ambiguous-write protections remain. The source repair is confined to this worktree; it has not installed or started another completion writer.

## Production audit

The read-only Langfuse observations query completed on 2026-09-18 at 16:55 KST, covering September 17 in Asia/Seoul across two pages. It found 191 roots, including 10 explicitly synthetic roots. Both the overall gate and the E-14 Codex gate failed. The Codex unknown identities and duplicate came from `macmini` records without the newer `run` metadata; this alone does not establish their cause or justify excluding them.

The retained report and identifier-only checkpoint are in `/Users/iyen/dev-tools/session-notes/linear-triage-20260918-quality/`. They contain no prompt or completion bodies. No audit date, population, scheduler, historical record or Linear state was changed. A fixture-based control-flow test is not evidence that the production gate passes.

## Verification and remaining access

The new regressions first reproduced the missing sleep-log failure and the legacy writer's ability to mutate E-03. After the repair, all 26 repository tests passed with the real server and Worker paths supplied, and validation found 33 valid skills and zero invalid skills. The existing bilingual-keyword warnings remain. Passing the actual September 17 report into the completion validator still rejected it without making any Linear call.

A fresh independent read identified missing operator references in the completion runbook; it now links the implementation contract and names the existing job's plist. A two-pass consistency audit found no remaining active SSH acceptance transformation in this worktree. Historical deployment evidence stays dated and retained. Tests verify control flow; authenticated Linear read/write verification remains unavailable.

The latest connector check still reports Linear uninstalled. Resume with a current dev-tools issue inventory and comments after connection, reconcile each proposed disposition, then apply and read back only authorized changes in that project. This work is not a completed backlog cleanup, and the local repair has not been deployed to the laptop job.
