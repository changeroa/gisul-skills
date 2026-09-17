# Completion

Immediately before closing, re-read the issue and latest comments. Map each current
acceptance criterion to direct evidence. Test totals, HTTP 200, agent idle and PR
merge do not establish a requested user flow.

Use the project's semantic state mapping and retrieve the team's actual state ID.
If a mapped state is absent, report it and keep the current state; never guess an
ID or silently substitute Done.

| Evidence | Stage |
| --- | --- |
| Implementation exists; verification incomplete | in_review |
| Verification complete; required deployment pending | in_review |
| Deployed; required user-flow verification pending | verifying |
| All scoped acceptance, deployment and required verification complete | done |
| Explicit cancellation or established duplicate | canceled, with replacement link |

An implementation-only issue may finish before a separate deployment issue when
that boundary was agreed; link it and avoid claiming production delivery.
A decision issue may close once its questions are resolved/excluded and affected
development issues are linked. It need not wait for implementation. A delivery
parent closes only when its own outcome and necessary children are complete.

Where human review is explicitly required, automated tests do not replace it.
Within authorized issue-management scope, close when the actual conditions are met
without asking again. Record a concise result, PR/commit, deployed environment/SHA
when relevant and acceptance evidence. Leave unmet checkboxes open. Re-query after
the state change. Comments or messages require existing authorization separately
from updating the issue description.
