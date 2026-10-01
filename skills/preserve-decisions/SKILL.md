---
name: preserve-decisions
description: Preserve scope, decisions and evidence across substantial work, session handoffs, and review-to-explanation or implementation handoffs. Keep code identities, runtime context and uncertainty traceable. Ordinary lookups and small edits use the current request or existing checklist.
keywords: ["선택한 시안", "디자인 합의", "합의 보존", "결정 기록", "작업 범위", "세션 인계", "다음 세션", "인수인계", "durable decisions", "scope preservation", "cross session handoff"]
---

# Preserve Decisions

Preserve effective agreements while applying the user's explicit changes. Several tool calls alone do not justify a contract.

## Keep the smallest useful record

Questions, short research and ordinary edits use the current request or existing issue. Substantial implementation/deployment, material requirement changes and cross-session handoffs use a short durable record when losing scope would affect the result. Link existing specifications instead of copying them. Keep workflow guidance remote in gisul; runtime code stays local.

## Keep the objective and choose the next action

Codex owns the working loop. Use a relevant existing native Goal; create one only when the user explicitly requests a Goal and the host tool permits it. Otherwise preserve the objective in the task record and continue authorized work. Do not add a process that repeatedly calls Codex merely to maintain persistence.

Choose the next action from actual results: fix a failure, obtain a missing observation, finish an authorized release step, or move to the next approved item. Reuse valid results. Repeating the same attempt without a changed cause, input or observation is not progress. Real dependencies can leave work partial/blocked; budget exhaustion is not completion.

## Preserve the agreement

Find the canonical requirement and relevant prior decisions. Separate effective decisions from proposals, assumptions, history and observed implementation. A newer timestamp or omission from a summary does not supersede an agreement.

Apply explicit changes to affected clauses and preserve the rest. Existing authorization continues to apply. Ask only about real unresolved conflicts affecting meaning, permissions, compatibility or retention, while continuing independent work. Planning and research do not authorize implementation or deployment.

Keep the deliverable and completion unit intact: links, retrieved detail, usable code and runnable examples differ. Do not invent a denominator or substitute an unapproved sample. Compare the original request with check coverage; inspecting the remaining items cannot recover an omitted requirement.

## Carry a selected design into implementation

When implementation follows a selected design, keep a small handoff in the existing specification or issue. Link the exact variant and version or snapshot, the selection evidence, and any user notes that override it. Record what changes and what remains effective, especially navigation, fields, primary actions and task steps. Do not create a separate contract for an ordinary visual adjustment.

A selected appearance does not by itself decide permissions, retention, backend behavior or removal of existing capabilities. Apply explicit product changes to the affected clauses; preserve other agreements. If the design and effective requirements conflict, isolate the unresolved point and continue independent work.

Connect each affected agreement to an observable acceptance condition and its eventual evidence. A prototype demonstrates only the states and interactions it actually implements; it does not prove production integration. Keep the selected design available for comparison after API integration and later fixes. Record intentional departures and their decision basis instead of silently replacing the baseline with the latest implementation.

## Carry reviewed evidence into explanation or implementation

Use this section when review findings move into an explanation, remediation plan, implementation task or another session. Reuse the canonical review report and evidence record; add only missing context there. A review handoff does not require a new runtime contract, a duplicate report, a Goal or a separate file for every finding.

Keep each finding addressable by its stable ID and inspected repository revision. Preserve the following where they affect the conclusion, using links to existing evidence instead of copying it:

- Exact function, class, field, collection, route and configuration names with their source locations. Pair unfamiliar names with a brief role description; distinguish an in-memory property from its backing collection and qualify ambiguous names by module or owner.
- Relevant execution and storage boundaries: where code runs, who owns each state value, its authoritative source, lifetime and refresh/invalidation behavior, and which requests or workers can change it. Separate source configuration from observed deployment and unverified assumptions.
- The violated contract, trigger and ordered path to user-visible impact; inspected safeguards and counterevidence; finding disposition and verification method. Preserve material unknowns and what observation would resolve them.
- Remediation rationale and applicable primary-source references, including product/version or checked date, prerequisites, tradeoffs and proposed verification. Reuse existing research; preservation itself does not establish technical correctness.
- The distinction between current behavior, a proposed change, an accepted decision, implemented code, executed verification and deployed behavior. Mark invented proposal identifiers as proposals rather than existing source names.

Before handing off, trace one complete chain for each finding: actual identifier and location → runtime/storage role → triggering behavior → impact → proposal and evidence, where a proposal exists. A reader should be able to identify which stored value changes, which code changes it and why the outcome follows without reconstructing omitted facts. If a link or fact is unavailable, retain the gap explicitly; never fill it from a familiar architecture.

The receiving step reads this record before shortening prose or drawing diagrams. Keep actual identifiers in technical diagrams and explain their meaning in surrounding prose. Do not replace a precise identity with only “cache”, “server” or “object”. Link the canonical record from derived explanations; reconcile new evidence there rather than silently creating competing versions.

On changed source or deployment, reassess the affected facts and dependent findings. Keep valid historical evidence attached to its original revision; do not relabel it as current. This handoff does not authorize fixing the product, publishing an issue, deploying, or delegating work.

## Observe outcomes for substantial work

Use the hook-provided runtime CLI and session ID. When `verify help` is available, its schema-v2 contract supports executable acceptance checks:

- Record the objective, stable task ID, requirement sources and linked checks once with `contract set --session <id> --file <task.json>`. Use real commands, an explicit cwd and actual outcome criteria. Keep credentials out of contracts and captured output.
- `verify status --session <id>` lists failed/unverified checks. Select needed work and use `verify run --session <id> --check <check-id>` within existing authorization. The runtime captures execution and evidence; never hand-write passing receipts.
- Prefer JSON observations and assertions for quantities, executed-test counts, UI/server state and deployed versions. Exit status is enough only when it expresses the whole condition. A skipped or zero-test run does not verify a required scenario.
- Reuse valid observations. Declare all relevant source/configuration inputs. Set `max_age_seconds` for live API, CI or deployment observations; use `--force` after deployment or external state changes. Input hashes cannot detect arbitrary remote changes.
- Run `contract complete --session <id>` before completing the recorded task. Resolve missing, failing, changed or expired evidence, or accurately record partial/blocked work. Complete a native Goal only after the entire authorized objective is achieved, including necessary browser or semantic judgment.

Keep the task ID stable within an objective. Preserve withdrawn requirements as `superseded` with `decision_basis`; material revisions include `change_basis`. A distinct objective uses a distinct task ID. Do not weaken checks or drop scope to make completion pass.

For older runtimes, descriptive handoffs or manual assessments, read [runtime-contract.md](references/runtime-contract.md) through gisul with this load's `load_id`. Its schema-v1 evidence is self-reported. That reference also covers execution tools and owned processes; read it only when needed.

## Verify the outcome

Trace changed rules into affected consumers, data, permissions and flows. Explore new user flows against actual UI and server results; retain reproducible checks for recurring failures. Use `ux-state-review` when its scenarios materially help, and the user's designated browser workflow for browser work. Add targeted semantic review for agreement or approved-design mismatches; do not add a second model to every turn.

Compare the full requested outcome with evidence. A build, process exit or contract check covers only its declared conditions. Programmatic checks do not prove complete requirements, visual meaning or adversarial authenticity of local receipts. Preserve observations and sources; do not manufacture a JSON report that merely claims success.

## Resume and hand off

Keep the objective, effective requirements, explicit revisions, valid evidence and remaining work. Reassess relevance and validity on resume. Record the actual deployed commit and canonical source path; retained worktrees/processes need a retention reason and cleanup condition. Report implementation, verification and deployment separately. This skill does not authorize delegation or external messages.

Stop checks only a relevant current-turn completion, with bounded corrective continuation. Schema 2 inspects command observations and validity; schema 1 checks recorded contradictions. Hooks do not execute verifiers or an agent loop. Honest partial reports and unrelated questions remain possible.
