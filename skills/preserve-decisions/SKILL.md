---
name: preserve-decisions
description: Carry existing agreements into follow-up planning, tickets, implementation, and verification; distinguish what a new request changes from what must remain. Use when establishing or changing requirements, extending or refactoring related functionality, resuming work after a handoff, or investigating lost agreements. Applies to UI, APIs, data, permissions, operations, and documentation. Skip the full workflow for formatting-only edits that do not change meaning.
---

# Preserve Decisions Across Changes

Treat a new request as a change to the currently effective agreements. Update what is explicitly changed, and carry the remaining relevant agreements into planning, implementation, and verification. Do not make the user repeatedly restate previous decisions.

## Scale the Process to the Work

Use existing specifications, decision records, and tickets first. A small change may need only a few lines in the existing record and a relevant check. Keep durable records for decisions that span multiple tasks. Do not add a new document, meeting, approval, exhaustive audit, or test suite to every task.

For planning, establish the baseline and the change. For implementation, also assess impact and verify outcomes. Do not expand an analysis or draft request into implementation or deployment.

## 1. Recover the Relevant Current Agreements

Identify the target of the request and the intended outcome. Consult its baseline document, decision records, and linked tickets, conversations, contracts, or designs. Distinguish:

- **Effective decisions:** Agreements with a confirmed scope and decision basis.
- **Proposals, assumptions, and deferred decisions:** Items not yet agreed or whose applicability conditions are not met.
- **Superseded or withdrawn decisions:** Historical context, not current implementation requirements.
- **Observed implementation:** What the code, UI, configuration, and tests currently do. This is not itself evidence of agreement.

Use a designated canonical source when one exists, while incorporating the user's explicit current changes. A newer timestamp does not make a proposal, summary, or implementation more authoritative than an accepted source. When historical wording matters, inspect the relevant version or revision history.

Expand the search to linked originals only when necessary evidence is missing or contradictory. Stop when the rules affected by this change and any material conflicts have been identified. Do not reconstruct the entire project conversation for every task.

If an original source is inaccessible, record what was verified and what remains unknown. Do not invent previous decisions or interpret missing evidence as the absence of constraints. Defer changes that depend on unresolved decisions affecting meaning, permissions, data retention, or compatibility; continue independent work.

## 2. Identify the Change Introduced by the Request

Classify affected agreements as needed. Do not fill categories that do not apply.

| Classification | Judgment and action |
| --- | --- |
| Preserve | A relevant agreement the new request does not change. Keep it in the completion criteria. |
| Add | A new condition compatible with existing agreements. Do not delete the existing conditions. |
| Modify or supersede | A condition explicitly changed by the user or through the established decision process. Update only the affected clause and scope. |
| Conflict or unknown | Conditions cannot both hold, or the effective decision cannot be determined. Resolve the specific difference. |

Changing part of a document does not invalidate all its agreements. Omission from a new ticket does not withdraw an existing agreement. Do not change semantics such as permissions, pricing, retention periods, or user journeys merely for implementation convenience.

Proceed without renewed approval when explicit user direction or existing context resolves the change. Interpret "go ahead" within the scope of the proposal approved in context. Do not extend it to withdrawing unrelated conditions that the proposal did not address.

Only when a real conflict remains, explain exactly where existing condition A and new condition B cannot coexist, then ask for the decision needed. Pause only the dependent work. Do not resurrect a decision the user explicitly superseded in the name of preservation.

## 3. Follow the Impact Across Related Areas

Check the producers, consumers, and operational flows that rely on the rule, not just the edited files. Select only relevant areas.

| Area | Commitments to trace |
| --- | --- |
| UI and workflows | Entry points, navigation, required information, step order, returning users |
| APIs and integrations | Input/output semantics, error contracts, existing clients, retries and duplicate side effects |
| Data | Ownership, identifiers, relationships, units and time conventions, retention/deletion, migration of existing data |
| Permissions and policy | Allowed actions per actor, approval versus access grants, state-transition conditions, exceptions |
| Asynchronous work and operations | Ordering, scheduling/retries, environment isolation, deployment/recovery, notification recipients and conditions |
| Performance and quality | Agreed latency, consistency, availability, and accessibility expectations; observable behavior affected by optimization |
| Documentation and planning | Terminology, decision status, committed scope and exclusions, linked operating instructions |

Do not add every possible improvement. Determine whether a newly discovered improvement is necessary to satisfy the current agreements. If not, separate it as a follow-up proposal.

## 4. Leave a Usable Record for the Next Task

Update the relevant clause in the existing baseline for durable agreements. Create a small project-local decision record and a discoverable entry link only when no suitable location exists and the work spans sessions. If the source cannot be edited within current permissions, leave the proposed change and its target location; do not report the source as updated.

The following is sufficient. Prefer the project's existing format; use a stable section link when no decision ID exists.

```text
Decision ID or section link / scope
Current rule and rationale
Status: proposed, effective, superseded, or withdrawn
Evidence: original link and version or date; decision-maker when known
For changes: replaced clause, rationale, effective time and affected population
Links: related work and verification evidence
```

Do not copy entire conversations. Keep current rules concise and link historical evidence. Distinguish superseded decisions from the current baseline while preserving the change history. Track agreement status separately from implementation, verification, and deployment status.

In tickets and plans, link the source and state **the final behavior that satisfies both the new conditions and the preserved conditions**. A checklist is the acceptance criteria for this task, not a competing source of truth.

For handoff or resumption, carry the baseline location and version read, modified and preserved conditions, unresolved decisions, and implementation/verification status. If another contributor may have changed the baseline, recheck the relevant changes before integration. This process does not itself authorize spawning agents, sending external messages, or deploying.

## 5. Derive Verification from the Agreements

Derive expected outcomes from the effective rules identified before implementation. Do not inspect the new implementation or design and redefine acceptance criteria to match it.

Connect each material modified or preserved condition to verification. A short list is enough for small tasks.

| Agreement and evidence | Modified or preserved | Observable outcome | Method and evidence | Result |
| --- | --- | --- | --- | --- |
| Decision link | Relationship to this task | Initial state → action/event → expected result | Test, actual behavior, document comparison, etc. | Pass, fail, or unverified |

Choose a verification level capable of detecting the defect. Use logic checks for calculations and transitions, integration checks for interfaces and persistence, and connected entry points for actual user journeys. Do not force new tests for simple document edits. Reuse existing checks and address material gaps.

Check effects on existing users, data, and clients as well as new ones. Select return visits, lost responses, revoked permissions, time boundaries, or similar scenarios when they could break the relevant rule. Do not invent policies as testing requirements.

Test counts, successful builds, successful tool calls, and matching deployment assets alone do not prove agreement compliance. If an agreement is unchanged and a check fails, do not weaken the expected result to fit the new implementation. If the agreement actually changed, update the relevant checks with the decision evidence.

Before completion, check both directions:

- Does each affected agreement have an implementation or deliverable and evidence supporting its assessment?
- Does each added, removed, or changed observable behavior have a basis in the request, an effective decision, or a justified implementation necessity?

Keep unverified conditions distinct from passes. Report, within the work actually performed, what changed, the important conditions verified as preserved, and remaining conflicts or verification gaps.

## Judgment Examples

| Existing agreement | New request | Application |
| --- | --- | --- |
| Hospital, usage, and account information share one navigation area | Separate connection requests from production-information entry | Separate the procedures within the unified navigation. |
| Repeating the same request must not duplicate a payment | Move payment processing to an asynchronous queue | Preserve the existing guarantee across queue redelivery and lost responses. |
| Relationship approval and access grants are separate | Automate review processing | Do not interpret automated review as automatic access grants. |
| Existing clients receive the current response contract | Optimize list retrieval | Preserve the fields and error semantics consumers rely on. |
| Retain logs for 30 days | Explicitly change retention to 7 days for logs created starting next month | Apply 7 days to the new scope; retain the separately applicable rule for older logs. |
| Notify operations only when the monitored state changes | Check every 5 minutes | Check more frequently without notifying on every run. |

Apply these example policies only when they are actual requirements of the project.

## Relationship to Other Workflows

Reuse results from request interpretation, canonical-source consolidation, and behavior-flow testing when already available. The gisul skills `readchk`, `ssotize`, and `test-behavior-flows` cover adjacent responsibilities, but installation or invocation is not required. This skill owns the connection from **existing agreements → change → work → verification**.

## Design Sources

- [NASA Requirements Management](https://www.nasa.gov/reference/6-2-requirements-management/): Informs change-impact analysis and links among requirements, design, and verification. This skill does not import organization-specific review boards.
- [Michael Nygard, Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): Informs concise rationale and status records, including traceable supersession.
- [Cucumber Example Mapping](https://cucumber.io/docs/bdd/example-mapping/): Informs separating rules, concrete examples, and unresolved questions when defining acceptance criteria.

Cross-session continuity and the examples above adapt these principles to agent work. They do not guarantee that a tool or model automatically remembers agreements or always invokes this workflow.
