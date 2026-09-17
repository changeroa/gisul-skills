---
name: linear-delivery
description: Turn Linear plans and agreed decisions into development tickets, implement within the requested scope, and close issues when acceptance evidence is complete. Use for Linear 기획 분석, 개발 티켓 분해, 이슈 구현과 완료 판정.
---

# Linear delivery

Keep the agreed decision, issue acceptance criteria and delivered behavior aligned.
Perform only the requested stages. Existing authorization continues; loading this
skill does not grant additional deployment or messaging permission.

Use the Linear API/connector. Resolve the actual workspace, team and project, then
read [the project index](references/projects/index.json). Match stable IDs and load
only that project's file and referenced policy from this skill's returned manifest.
Do not construct traversal URIs or select a similarly named project. If the target
is ambiguous, ask for the missing target while continuing independent analysis.
An explicit target with no maintained policy can use the user's instructions and
the team's current templates/statuses; do not invent missing product decisions.

- For planning and ticket creation, read [intake](references/intake.md).
- For implementation, read the issue, latest comments and repository AGENTS.md.
- For completion or cancellation, read [completion](references/completion.md).
- Before external writes, read [writes](references/writes.md).

Use the team's retrieved implementation/decision template as appropriate. Keep
titles short. Start descriptions with the user-visible outcome or decision, then
observable acceptance checkboxes or numbered decision questions. Keep only relevant
dependencies, decided rules and source links at the bottom. Preserve substantive
requirements; distinguish proposals, decisions, implementation and verification.

Issue changes do not authorize Slack messages. Follow the matched notification
policy and avoid duplicate automatic notifications. Report actual issue URLs,
verified state and remaining decisions or work.
