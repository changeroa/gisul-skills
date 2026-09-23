---
name: preserve-decisions
description: Preserve scope and prior decisions during substantial implementation, deployments, cross-session handoffs, or material requirement changes. Ordinary lookups and small edits use the current request or existing checklist.
---

# Preserve Decisions

Carry forward relevant decisions while applying the user's latest explicit changes. Use this workflow when losing scope or an earlier agreement would materially affect the outcome. Several tool calls alone do not justify loading this skill or creating a contract.

## Choose the smallest useful record

- For questions, short research, and ordinary edits, work from the current request and existing issue or specification. No separate contract is needed.
- For substantial implementation or deployment, work that must survive a session handoff, or material changes to established requirements, keep a short durable record. Reuse and link existing specifications rather than copying them.
- If the runtime needs a contract for that work, read [runtime-contract.md](references/runtime-contract.md) through gisul with the current `load_id`. Use the hook-provided runtime CLI and session ID. Do not read this reference for routine work.
- Keep workflow skills remote in gisul; local hooks and executables remain local.

## Preserve the agreement

Find the canonical requirement and only the prior decisions relevant to the change. Separate effective decisions from proposals, assumptions, historical decisions, and observed implementation. A newer timestamp or omission from a new summary does not by itself supersede an agreement.

Apply the user's explicit changes to the affected clauses and preserve the rest. Existing authorization continues to apply; do not ask for renewed permission to carry it out. If a real unresolved conflict affects meaning, permissions, compatibility, or retention, ask about that specific conflict while continuing independent work.

Keep the requested deliverable and its completion unit intact. For collections, links, retrieved detail, usable code, and runnable examples are different units. Do not invent a denominator or replace the requested whole with an unapproved sample.

## Work and verify

Trace the changed rule only into affected consumers, data, permissions, or operational flows. Do not turn a narrow task into a repository-wide audit. Planning and research requests do not authorize implementation or deployment.

Choose checks that demonstrate the requested behavior. Reuse actual test results, command exits, screenshots, or deployed commit evidence. Do not rerun checks or create documents just to satisfy a generic procedure. Stateful UI changes may use the remote `ux-state-review` workflow when its scenarios materially help; no universal E2E suite is required.

Before reporting completion, compare the requested scope and preserved conditions with the outcome. A successful build or many passing tests do not cover missing requirements. Continue feasible authorized work; accurately report partial or blocked results when a real dependency prevents completion.

## Resume and hand off

When a durable record is needed, keep the objective, material requirements, changed decisions and their basis, evidence, and remaining work. Link sources instead of copying conversations. Start a new assessment for a new objective so an old completed task cannot stand in for new work.

Report implementation, verification, and deployment separately. For deployment, record the actual deployed commit and canonical source path. For a handoff, also record retained worktrees or processes and their cleanup conditions. This skill does not authorize delegation or external messages.

The completion hook checks recorded contradictions, not the truth of arbitrary evidence or the user's entire request. It should inspect an active relevant task, allow honest partial reports, and request only bounded corrective continuation.
