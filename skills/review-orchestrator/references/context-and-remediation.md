# Context, remediation and review handoff

Use only the sections required by the review. Keep evidence in the existing report and linked artifacts. These requirements do not grant production access, execution, delegation or publication permission.

## Establish material runtime premises

Before distributing a runtime-dependent investigation, identify the relevant entry point, executing process/service, authoritative store and other writers. Share evidence and unknowns with the selected specialists, not candidate conclusions. Extend this map as paths are discovered.

For each affected finding, connect:

| Premise | Minimum useful evidence |
|---|---|
| Execution location | Actual function/route and its path through deployment boundaries; relevant runtime/product version |
| State identity and ownership | Exact object/property/collection names, owner, authoritative source, lifetime and refresh/invalidation behavior |
| Possible overlap | Requests, jobs or administrative writers; await/transaction/lock boundaries; actual exclusivity if claimed |
| Conclusion sensitivity | Which configuration, guarantee or unknown would change the verdict or remedy |

Distinguish source/configuration evidence, deployed observations and assumptions. Attach revision or observation time/environment. Do not infer that backend state lives in an edge isolate because an edge proxy precedes it. One process does not alone establish serialized operations, and multiple processes do not alone establish a race.

Trace the relevant boundary rather than reconstructing the entire architecture. A missing repository profile is not itself a blocker: derive supported facts from available evidence, label unknowns, and use NEEDS_CONTEXT only when an unknown changes defect validity. Required execution gaps still affect review completeness under the review contract.

## Research before recommending remediation

Before proposing or endorsing a remedy, investigate best practices for the actual context. Scale the depth to the decision; do not expand a small correction into a redesign exercise.

1. State the invariant or behavior to restore and the material execution, persistence, compatibility and resource constraints.
2. Read applicable primary sources: official product/framework/database documentation, format specifications or relevant original design/research material. Record URL or document reference, applicable version and verification date. A supplied authoritative document can serve as evidence; an unvisited link cannot. Reuse prior research when its validity and applicability are rechecked.
3. Connect the documented guarantee and prerequisites to the inspected code/configuration. Explain why the proposed mechanism closes the failure path, which existing safeguards remain relevant and what it does not solve. Distinguish a source's claim from reviewer inference.
4. Consider materially different alternatives when they affect complexity, compatibility, consistency or operating cost. Recommend the smallest sufficient change; no quota of alternatives is required.
5. Specify a verification that exercises the original failure and preserves valid behavior, including relevant error/retry or concurrency ordering. Label unexecuted tests and new identifiers as proposals.

Record a concise chain: `restored invariant → contextual guidance and evidence → applicability → change and tradeoffs → remaining uncertainty → verification`.

When research is unavailable or prerequisites are unverified, retain a conditional remediation direction and the exact missing check. Do not describe it as a validated recommendation. A proven defect may remain CONFIRMED independently of solution readiness. General best-practice noncompliance remains insufficient evidence of a bug.

## Full-repository coverage

Only for a whole-repository audit, inventory material behavioral paths and update coverage as discoveries expand scope:

`path/entry point → validation and authorization → state mutation → persistence/external effect → response or recovery`

Include relevant background, administrative and deployment/recovery paths. Record reviewed/partial/unreviewed scope, evidence and the remaining action per path. Examples are account disable through session invalidation, upload through validation/storage/failure cleanup, and deployment through artifact activation/version observation/rollback. These are examples, not required features in every repository.

File or agent counts do not prove coverage. Unread relevant paths remain visible and affect completeness. For a normal PR, use affected paths rather than starting an unrelated full audit.

## Preserve the handoff through Gisul

When review findings move into explanation, a remediation/implementation task or another session, discover and load the current remote `preserve-decisions` skill using Gisul and retain its release/commit. Apply its **Carry reviewed evidence into explanation or implementation** section. Use the canonical review report and evidence as that record; do not copy the skill body into this package or create a parallel preservation schema.

The receiving step, including `review-explainer` when applicable, reads the same record before shortening explanations or drawing diagrams. The user must authorize any implementation or publication independently of this handoff.

If Gisul or the skill is unavailable, state the limitation and continue supported review using existing artifacts. Do not claim the handoff was verified or invent missing context. This dependency does not apply to ordinary lookups or cosmetic edits without a substantive review handoff.

## Existing report compatibility

Keep FindingV1 and its validator unchanged: use `trigger`, `execution_path` and `counterevidence` for material premises, `evidence` for their sources and researched guidance, and `remediation` plus `suggested_test` for solution applicability, conditionality and verification. Put audit-path coverage in the human report and reflect outstanding paths in `unreviewed_scope` and module/review status. Do not add undeclared fields to strict JSON reports.

The structural validator cannot verify these semantic obligations. The verifier must inspect their actual contents and source support.

## Remote resource loading

These references belong to `review-orchestrator`. When another skill links here, first load that owner at the pinned catalog commit and read the exact declared resource using its `skill_uri` and `load_id`. Do not call read_skill_file with another skill's load_id or guess a local filesystem equivalent. For the later preservation handoff, select the current skill within the same pinned release when available and record any deliberate version change.
