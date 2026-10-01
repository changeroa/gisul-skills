---
name: review-client-runtime
description: "Review client code execution defects: asynchronous races, component lifetimes, form events, browser storage, SSR/navigation, value conversion and API integration. Use for frontend source correctness and client-server boundary failures. User-facing state design, visual usability and browser E2E observation belong to their existing dedicated skills."
metadata:
  version: "1.2.0"
---

# Client Runtime Correctness

## Scope and evidence

Pin the source revision and follow the actual user action through event handler, local state, request, response and rendered result. This skill provides review guidance, not execution permissions. Read upstream guards and actual framework/runtime configuration before making a claim. Keep secrets out of evidence and leave inaccessible or unexecuted paths explicit.

For runtime-dependent findings and before recommending a remedy, use [context and remediation](skill://gisul/gisul/review-orchestrator/references/context-and-remediation.md). Load the owning review-orchestrator skill at the pinned catalog commit before reading its resource. Research applicable primary-source guidance and keep defect validity separate from remediation readiness.

The earlier review-frontend skill mixed mechanisms with state design and visual inspection. This skill owns the mechanism: identify the code path that can produce the wrong client result. It does not claim ownership of every frontend concern.

| Question | Primary owner |
|---|---|
| Can request ordering, lifecycle or browser behavior corrupt the client's result? | review-client-runtime |
| Does each reachable product state provide a coherent explanation and valid next action? | ux-state-review |
| Can users discover, understand and choose the intended action from the visible screen? | dont-make-me-think |
| Does the real UI correctly transition through pending, failure and recovery, with visual/request/storage evidence? | browser-e2e-review |

A suspected runtime defect can need browser verification, and a UX reviewer can uncover it. Share the evidence and assign one root-cause finding; do not count the same problem once per skill. Do not activate all neighboring skills merely because UI code is present. Browser automation follows the environment's current aside-browser instructions.

## Core rules

### UI-01 — Request-state correspondence

Trace the state updates caused by request start, completion, rejection and cancellation. Verify that a completion belongs to the current operation and that errors are not mechanically mapped to empty success or success to stale failure. Check reentrant clicks and submission guards against actual API effects. Identify the failing assignment or branch; whether wording or next actions fit product states belongs to ux-state-review.

### UI-02 — Asynchronous races and optimistic writes

Construct input A → input B → response B → response A where reachable. Check identity guards, abort handling and cache keys, including account/tenant/route changes. Verify whether an optimistic rollback overwrites a later edit or confirmed operation. Aborting a request alone does not prove the server performed no effect. Read existing guards rather than requiring a particular cancellation API.

### UI-03 — Component lifetimes and derived state

Inspect effect dependencies and cleanup, timers/subscriptions/listeners, stale closures, unstable keys, and state retained across owner changes. Trace synchronization between server data, local drafts and derived values. Explain an actual wrong result or resource lifetime; do not call repeated renders a defect by themselves. Distinguish development-only framework behavior from production.

### UI-04 — Form events and input serialization

Trace native submit, Enter, click, composition, paste and autocomplete paths where supported. Check duplicate event dispatch, dropped input, controlled/uncontrolled transitions, empty/null/omitted values, and how server errors update field state. Confirm that disabled/read-only and native form semantics match intended events. User-facing field explanations and recovery choices remain UX concerns; client validation is never server authorization.

### UI-05 — DOM interaction mechanics

Inspect semantic elements and event handling when they can break keyboard execution, focus movement/restoration, dialog lifecycle, or dynamic status announcements. Trace refs and focus targets across conditional rendering and unmounts. Static source can establish some defects but cannot prove observed screen-reader behavior, visible focus or accessibility conformance. Share visual/interaction verification with the existing browser and usability skills; do not duplicate their full checklists.

### UI-06 — Browser storage, SSR and navigation

Check availability and exceptions for browser APIs, storage denial/quota, server/client initial-value differences and hydration. Trace refresh, deep links, back/forward, cross-tab session changes and reconnection through actual state owners. Verify framework/platform version behavior with primary sources. Avoid inventing unsupported environments as contractual requirements.

### UI-07 — Value conversion at the client boundary

Trace date/timezone, locale, numeric units and identifier conversion between display values, draft state, storage and API payloads. Verify parsers and serializers rather than assuming displayed strings round-trip. Preserve missing values distinctly from zero or empty input when the contract requires it. Translation quality and visual text wrapping are outside this rule.

### UI-08 — API integration and failure propagation

Verify handlers call the real intended endpoint with current resource identity and credentials, map actual response/error contracts, and invalidate or refresh the correct cache. Check response-body parsing, download/object-URL lifetimes and whether mock responses remain reachable in production. Security authorization and backend guarantees belong to their server specialists; coordinate rather than assuming UI controls enforce them.

## Required evidence and counterevidence

Give the actual identifier/location and runtime owner, trigger, ordered event/request/response/state changes, violated contract and user-visible consequence. Inspect request guards, loaders, error boundaries, browser wrappers and component primitives that could disprove the claim.

Separate SOURCE_TRACED from EXECUTED. Browser evidence records actual role, state and browser conditions; do not describe source inspection as a screen observation. A replayable regression should fail for the missing guard or wrong transition, not an unrelated timeout. Serial mocks do not demonstrate an asynchronous race.

## Output and compatibility

Use the orchestrator's FindingV1 evidence contract when performing code review. Return CANDIDATE or NEEDS_CONTEXT for verifier adjudication, with counterevidence, conditionality of remediation and a proposed test. Never invent line numbers or passing executions. Even with no findings, record inspected paths, safeguards and remaining scope.

The remote skill name is review-client-runtime. FindingV1 version 1.0 retains the legacy module key review-frontend and UI-01 through UI-08; use that key only in that schema and record the canonical skill name in the human report. Native UX/visual findings must not be forced into these rule IDs. The rename does not establish backward-compatible semantics for every old frontend rule; old reports stay attached to their original version.

## References

- [React effects and cleanup](https://react.dev/reference/react/useEffect)
- [HTML form control infrastructure](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html)
- [W3C accessibility guidance](https://www.w3.org/WAI/WCAG22/quickref/)
