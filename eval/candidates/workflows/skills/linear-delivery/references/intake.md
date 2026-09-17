# Intake

Read the source plan, latest comments, linked documents, children and dependencies.
Reconstruct explicit agreements in order. A recent suggestion is not automatically
a decision. Check existing implementation before writing new work.

Separate agreed outcomes, unresolved product questions and independent work.
Use the retrieved decision template for unresolved questions; number the choices
that require a decision and give the decision issue a short completion checklist.
Link dependent implementation work with blocking relations. Continue independent
work when an unresolved decision does not affect it.

Split work by independently verifiable outcomes. Files or frontend/backend layers
alone do not require separate tickets. Existing implemented behavior needs only
the remaining verification/deployment work. Link children to the source plan and
use real issue URLs for dependencies.

Acceptance describes the relevant role, entry action and observable result. Check
current schemas/API contracts before using field names or behavior as requirements.
Do not add guessed product policy to make a ticket look complete.

When decisions change, update affected acceptance and dependencies. Keep rejected
proposals out of current requirements. A parent tracks delivery and stays open
until its own outcome is met, even after its children have been created.
