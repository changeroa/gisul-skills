# Review Contract / FindingV1

This contract defines this package's operating rules. It is not an external standards certification system.
Reports must show review scope together with evidence limitations.

## Sources of facts

| Category | Meaning | Limitations |
|---|---|---|
| SOURCE | Source, schema, or configuration read directly at a specific revision | Consistency with actual deployment settings requires separate verification |
| EXECUTION | Actual execution or observation in a recorded environment | Limited to that input, environment, and path |
| DOCUMENT | Documented contract, official documentation, or trusted operational evidence | Verify version, publication date, and applicable environment |
| AUTHOR_CLAIM | A claim by the PR author or another agent | Not independently verified fact |

Do not confuse evidence sources with verification methods. A reference link is not a reproduction result.
Record code locations as `revision + path + actual start_line/end_line`. Include only the smallest necessary source snippet.

## FindingV1 fields

- `id`, `module`, `rule_id`: unique identifier, owning module, and rule ID from this skill pack.
- `title`, `claim`, `contract`: a one-sentence issue, claim, and violated contract. State when the contract is unclear.
- `primary_location`: the smallest location connected to the issue. Explain its relationship to the changed hunk through `change_relation`.
- `trigger`: required input, permissions, state, timing, and concurrency ordering. Verify that these conditions are possible.
- `execution_path`: the path from entry point to outcome. Do not skip intermediate safeguards.
- `impact`: what goes wrong, for whom, and to what extent. Do not exceed the verified scope.
- `evidence`: separate source, execution, documentation, and author claims by source category.
- `counterevidence`: conditions under which the claim could be wrong and where they were checked. Do not supply only the word "none."
- `verification`: method, result, and observations. Execution requires command/environment/exit_code/artifact_ref.
- `suggested_test`: a reproduction test or necessary verification. Do not claim that unexecuted code passed.
- `remediation`: the smallest change direction that restores the contract. Do not demand unnecessary wholesale redesign.
- `human_check`: an exact question or brief verification procedure for the human.
- `duplicate_of`: the original finding ID when duplicated; otherwise null.

## Status and confidence

Initial `CANDIDATE` is an intermediate state and must not remain in the final JSON.

- `CONFIRMED`: the current snapshot's code path and conditions are connected, and the violated contract and impact are supported.
- `NEEDS_CONTEXT`: a plausible hypothesis with an important unknown contract, configuration, or reachability fact.
- `REJECTED`: counterevidence defeats the claim, or it is merely an implementation preference. Record the reason.
- `DUPLICATE`: overlaps an existing finding in root cause, impact, and remediation unit. Link to the original.

`HIGH / MEDIUM / LOW` confidence levels are working assessments, not calibrated statistical probabilities.
Keep confidence separate from severity. Do not finalize a LOW-confidence candidate as CONFIRMED.
Security and concurrency defects that are difficult to execute can still be confirmed as SOURCE_TRACED when static tracing is sufficient.

## Verification status

`verification.method`: `EXECUTED / SOURCE_TRACED / NOT_VERIFIED`
`verification.result`: `SUPPORTS / CONTRADICTS / INCONCLUSIVE`

CONFIRMED requires a SUPPORTS result and at least one directly read SOURCE evidence item.
EXECUTED additionally requires EXECUTION evidence and a sanitized execution record.
For SOURCE_TRACED, set command/environment/exit_code/artifact_ref to null.
NOT_VERIFIED requires INCONCLUSIVE. A test reproducing failure can support a claim while returning a nonzero exit code.
Therefore, do not equate "process exit=0" with "the bug claim is correct."

## Relationship to the change

- `INTRODUCED`: absent in base and newly created by this change.
- `EXPOSED`: a pre-existing problem becomes newly reachable or affects a broader scope because of this change.
- `PRE_EXISTING`: existed unchanged independently of this change. Report it in a separate section.
- `UNKNOWN`: the base or relevant call path could not be verified. Do not attribute the problem to the PR as fact.

## Severity: this package's operating definitions

| Level | Criteria |
|---|---|
| S0 | A realistic path to widespread irreversible data loss, severe privilege or secret compromise, or similar impact warranting consideration of an emergency stop |
| S1 | Major feature failure, an actual authorization-boundary breach, integrity corruption, duplicate irreversible side effects, or similar impact to fix before release |
| S2 | An observable incorrect result or meaningful regression for a particular valid input or flow |
| S3 | A limited-impact issue warranting improvement; do not create it solely from style preferences |

Do not lead with an alarming severity when triggering conditions and impact scope cannot be explained.
Noncompliance with a general best practice is not, by itself, an S1 or S2 bug.

## Review status and module status

`review.status`:
- REVIEWED: the agreed change scope and applicable module paths were read. This does not establish whole-system safety.
- PARTIAL: some necessary files, paths, or verification remain outstanding.
- BLOCKED: essential inputs or access for meaningful review are unavailable.
- STALE: the target snapshot changed during review.

Record all ten specialist modules and the verifier exactly once in `module_runs`.
Their statuses are `REVIEWED / PARTIAL / BLOCKED / NOT_APPLICABLE`. N/A requires a rationale.
The verifier cannot be N/A: even with zero candidates, it audits scope, execution claims, and the final determination.

## Final recommendation

Apply these rules in order. Risk classification alone does not automatically block a change.

1. Any CONFIRMED S0/S1/S2 finding classified as INTRODUCED or EXPOSED requires CHANGES_REQUESTED.
2. Otherwise, PARTIAL/BLOCKED/STALE review, unreviewed scope, NEEDS_CONTEXT, any BLOCKED/PARTIAL module, or FAIL/BLOCKED checks require HUMAN_REVIEW_REQUIRED.
3. Otherwise, use NO_BLOCKING_FINDINGS.

Escalate serious pre-existing findings or findings with UNKNOWN change relevance for separate human review as well.
Do not turn unexecuted checks into passes without justification. Missing important execution verification must affect PARTIAL status, not only the limitations text.
Every result must keep `human_approval_required=true` and `publish_authorized=false`.
No result constitutes automatic merge approval.

## Remote skill identity and mixed review outputs

The registered skill formerly called `review-frontend` is now `review-client-runtime`, focused on client execution mechanics. FindingV1 retains `module: review-frontend` and UI-01 through UI-08 as legacy serialization identifiers; load the new skill name. This mapping is not an alias for general UX or visual review.

Existing `ux-state-review`, `dont-make-me-think` and `browser-e2e-review` outputs keep their native evidence and criteria in the canonical human report. Do not fabricate source locations or code-rule IDs to pass this schema. A FindingV1 export is explicitly limited to code findings, not all findings from a multi-skill review. Validate visual observations and heuristic uncertainty on their own terms.
