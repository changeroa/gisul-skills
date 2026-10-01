---
name: contribute
description: "오픈소스 기여 후보를 검증하고 실제 동작 근거를 갖춘 작은 수정과 PR을 만든다. Open-source contribution triage, implementation, verification, and review follow-up에 사용한다."
---

# Contribute

Produce a useful upstream contribution whose scope and claims a maintainer can verify. Prefer one independently reviewable fix over a target number of PRs. Follow the target repository's current contribution rules and the user's requested area.

## Pick work that is still needed

Read root and affected-directory contributor instructions, the PR template, required checks, and any AI-contribution policy. Record the upstream base commit.

For each serious candidate, inspect the issue, comments, linked PRs and their outcomes, recent source, and relevant commit history. Search open and merged PRs by issue number **and** the affected behavior or symbol; inspect issue timeline connections when available. An unassigned issue or an empty title search does not prove no one is working on it. A closed prior PR may document a missing live proof or an unacceptable design.

Keep a short candidate note: user-visible failure, production caller, likely owner/files, reproduction available, competing work, and why to pursue or drop it. Rank by confirmed need, achievable proof, and bounded change. Do not manufacture extra work to meet a quota. If a candidate is already fixed, cannot be reproduced, requires unavailable external access, or depends on an unresolved design choice, disclose that and choose another candidate within the authorized area.

## Establish the boundary before implementing

Trace the real entrypoint to the failing owner and distinguish the observed defect from a hypothetical consequence. A missing diagnostic is not proof of data loss; a helper test is not proof that the production caller uses the helper.

State the intended behavior, adjacent behavior to preserve, affected files, acceptance evidence, and genuine owner decisions. For queue, retry, timeout, or cleanup changes, consider the relevant neighboring contracts: cancellation, resource ownership, retry replay safety, continued processing after failure, and expected no-op cases. Do not turn this into an unrelated redesign.

Use the runtime's existing planning surface:
- In a deep interview, offer these boundaries and proof requirements as scope proposals before topology confirmation. Reuse answers already supplied. Route later scope changes through the parent workflow.
- In execution, read the selected remote skill at the assigned commit and implement only the accepted scope. Preserve the URI, commit, digest and relevant constraints in the existing plan or handoff; do not install a local copy of the workflow.
- For authorized parallel work, assign distinct issues or file ownership, separate branches/worktrees, and an explicit integration owner. If an edit crosses ownership, coordinate before touching the same files.

This skill adds no publication permission and no new approval gate. Honor authorization already given; prepare all reviewable work before asking about any genuinely unauthorized external action.

## Build evidence with the patch

For a bug fix, first capture a failing behavioral assertion or reproducible trace on the base, then show the same check passing on the candidate. Use isolated state, ports, and disposable fixtures so verification cannot alter a user's live installation.

Choose proof that exercises the changed boundary:
- Reuse the smallest existing fixture that catches the regression, including a relevant unchanged/control case. Avoid importing a large integration harness for a tiny assertion without need.
- If the claim spans a caller, transport, persistence, or operating-system boundary, exercise that boundary through a real entrypoint. A controlled provider stub can prove what requests a real runner sends; identify the stub and do not call it a live provider test.
- Honor target-specific live platform or tenant requirements. A mock cannot silently substitute for required real-browser, device, or provider evidence. State exactly what remains unverified.
- For cancellation or waiting changes, prove settlement while the blocking predecessor is still blocked. For cleanup, prove both unexpected-failure visibility and continued processing/expected missing-item behavior when relevant.

Keep the patch focused and use established repository checks. Run the relevant checks again after changes that affect their result. Record command, base/head, exit status, observed assertion or trace, and limitations. Measure test cost when new tests substantially affect runtime or reviewers request it; distinguish wall time, build/transform time, and assertion time.

## Review and present the contribution

Inspect the final diff for scope, regressions, and unsupported claims. Separate:
1. A code defect the contributor should fix.
2. Missing evidence the contributor can obtain.
3. A product/ownership tradeoff that needs a maintainer decision.

For an owner decision, explain the operational consequence, existing behavior, realistic options, and recommendation. Providing options does not mean the owner accepted them.

Use the repository's PR template. Lead with the concrete trigger and user-visible before/after behavior; add the root cause, narrow change, reproducible evidence, checks, and material limits. Link the issue and any prior attempts that explain this approach. Preserve real Markdown (for CLI submission, prefer a body file). Do not paste internal agent transcripts or boilerplate audit histories.

Immediately before publication, recheck issue state, competing PRs, upstream changes, and the actual diff/head. Drop a superseded contribution instead of publishing it anyway. Scheduling or bulk publication is only appropriate when requested.

## Follow through without overstating completion

Read check results and reviewer comments for the **current head**. A failed check is neither automatically caused by the patch nor automatically unrelated. Inspect its failing command/log and compare against the base or a focused reproduction when needed. Report passing, failed, cancelled, and pending results separately. Do not call CI green while checks are pending or red; a locally passing test alone does not establish a CI flake.

Respond to actionable findings by updating the patch and its evidence. Reuse an existing PR rather than creating duplicates. Respect repository and user communication rules; do not post unsolicited repeated comments or trigger maintainer-only repair/merge commands.

Report implementation, verification, PR publication, and merge status separately. Record the canonical checkout, branch/head, PR URL, and remaining work. Remove temporary worktrees only after changes and evidence are preserved and no active agent uses them; otherwise record their retention reason and removal condition.

For examples of how these decisions arose, read [OpenClaw lessons](references/openclaw-lessons.md) when evaluating proof quality, superseded work, or maintainer tradeoffs.
