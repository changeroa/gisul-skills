---
name: herdr-orchestrator
description: Proactively create Herdr panes and delegate independent work to coding agents, with active lifecycle monitoring, edit ownership, conflict resolution, and verified integration. Use when coordinating multiple agents through Herdr or when asked to act as a Herdr orchestrator.
keywords: ["Herdr", "다중 에이전트", "코딩 에이전트", "독립 작업", "위임", "분담", "pane orchestration", "multi agent coordination", "delegate independent work"]
---

# Herdr multi-agent orchestration

Herdr is a terminal workspace manager that lets agents discover other agents, create tabs and panes, send prompts, inspect output, and observe lifecycle events. Verify the actual connection and target session; do not assume the caller is inside Herdr or require HERDR_ENV=1 as a prerequisite.

Act as the orchestrator for the user's task. Own the outcome from planning through integration and verification.

When the user asks to use this skill for a task, treat that request as authorization to create the helper panes and start the agents needed for in-scope parallel work. Do not ask for separate approval for each pane or assignment. Merely searching, reading, translating, or editing this skill is not a request to launch agents. Follow higher-priority execution and delegation constraints; this skill does not override them.

If another orchestrator assigned you a bounded task, act as its worker: stay within your assignment, report back, and do not create additional agents unless explicitly delegated that responsibility.

## Task topology and ownership

Use a workspace for a project, a tab for one independently completable goal, and panes for that goal's agents and processes. Record the tab's exact `goal_tab_id`; an OS window, UI focus, tab title, or shared cwd is not a task identity.

- Keep follow-up requests for the same goal in its existing tab. Start an independent goal in a new tab, preserving user focus. Do not treat every new message as a new goal or repurpose a completed goal's tab for unrelated work.
- For a new goal, establish its project workspace, create a tab with `--no-focus`, and record the returned tab/root-pane IDs before starting participants. If the current coordinator belongs to another active goal, hand off the new goal to a coordinator in the new tab; do not move the existing coordinator or silently assign it both goals.
- Resolve the goal tab before creating or reusing a worker. Match the caller's exact Codex session to its live pane/tab, or use an explicitly established goal-tab mapping when coordinating from outside Herdr. If that mapping is unresolved, continue useful local work without guessing a target for pane mutations or messages.
- Create and reuse workers only inside the goal tab. A ready agent in another tab remains outside this task even when its cwd or project matches. Different worktrees are allowed inside the same goal tab.
- Tab membership defines the observation boundary; assignment defines who may receive work. Record the parent session/pane and each assigned worker's session/pane. An unassigned agent in the same tab is not automatically available for reuse.
- Keep active participants in the goal tab. On a move outside it or replacement of a pane's session, suspend the old assignment and stop dispatching to it. The parent may bind a verified successor inside the goal tab after releasing the old assignment. Transfer to another goal requires an explicit handoff to its coordinator; never silently adopt the new occupant or continue cross-tab coordination.

## 1. Discover the environment

Before coordinating work:

- Identify your current session, workspace, goal tab, pane, and repository. Verify that Herdr is available and connected before attempting orchestration.
- Inspect agents and assignments in the resolved goal tab before creating helpers. A global snapshot's session, pane, tab, and workspace metadata may establish identity and topology; it does not expand task ownership or justify reading unrelated agents' output.
- Distinguish agents participating in this task from unrelated sessions. Visibility alone does not authorize taking over another agent.
- Consult the installed Herdr instructions with `herdr --skill` if they are not already available. Use CLI help and `herdr api schema --json` to verify commands, capabilities, and event names.
- Use IDs returned by Herdr. Never infer IDs from position or numbering.

Use Herdr's agent controls for recognized agents and pane controls for ordinary shell processes. Create or identify an available shell pane before starting an agent there. Preserve the user's focus when layout commands support it.

## 2. Keep monitoring active

MUST enable the available monitoring tool before creating agents, dispatching parallel work, or modifying tabs and panes.

Monitor agent discovery, status changes, exits, and relevant tab, pane, and layout lifecycle changes within `goal_tab_id`. Include newly created panes in that tab. General subscriptions may support identity recovery, but only goal-tab events are task notifications. Resolve events without tab information through verified topology, including the last verified mapping for a close event.

Ignore notifications from other tabs for task coordination. A `Herdr changes` notification is an observation, not an assignment or permission to prompt, answer, or take over another agent. When identity or tab membership is uncertain, refresh the mapping before acting.

Verify that monitoring is active; intending to enable it is insufficient. If no dedicated monitor tool exists, use supported Herdr event subscriptions. Discover actual event names instead of inventing them.

Establish the subscription before taking the initial state snapshot. Buffer events during the snapshot, then reconcile them with current state. After a disconnect, context recovery, or suspected event gap, restore monitoring and refresh the snapshot before relying on cached state.

Consume events throughout the task, including while doing your own work. A background process writing logs is insufficient unless those events are actually delivered to you or inspected at bounded intervals.

If streaming is unavailable, use bounded polling and state that monitoring is degraded. If neither works, continue useful local work without starting additional parallel tasks. Restore observability before further orchestration mutations.

## 3. Delegate bounded work

Actively look for parallel work at the start and at each meaningful phase transition. When a bounded subtask can progress independently while you do useful work, delegate it rather than completing everything serially. Suitable examples include investigating a separate component, implementing independently owned files, or reviewing a prepared change while you work on integration.

After establishing monitoring and inspecting current assignments, reuse an available shell pane or a ready worker assigned to this task inside `goal_tab_id`. If none is suitable, create a sibling pane in that goal tab and start a helper there. The absence of an existing idle pane is a reason to create one, not a reason to reuse another tab's agent or skip useful delegation. Preserve the assigned working directory and the user's focus, using explicit verified session/pane IDs. When operating from outside Herdr, establish the intended goal tab and target pane explicitly; do not assume the UI-focused pane belongs to this task.

Start with one useful helper and add more when each has independent work and a clear owner. Do not require the user to request a pane count. Keep short tasks and work with inseparable shared edits local; do not split work merely to increase the number of panes.

Once a worker finishes, verify its result and reuse that pane for the next independent assignment. Continue your own work and consume monitoring events instead of waiting idly. If no useful parallel work exists or a concrete connection, monitoring, or policy restriction prevents it, proceed locally and state the specific reason briefly.

For each assignment, provide:

- A unique task ID and the responsible orchestrator.
- The exact goal tab and parent session/pane to report to.
- The objective, relevant context, and dependencies.
- The repository/worktree and files or resources the worker may modify.
- Constraints, expected deliverables, and acceptance criteria.
- Required validation and where to report results.
- A requirement to report blockers and ownership conflicts promptly.

Confirm that the worker accepted the assignment. A successful prompt submission alone is not acceptance.

Maintain a compact task ledger containing `goal_tab_id`, the parent session/pane, and each assigned worker's session, pane, working directory, ownership, dependencies, and progress. Keep task progress separate from Herdr's observed agent status. Membership tracking does not itself enable automatic continuation prompts.

Persist enough coordination state to recover assignments and pending decisions after context loss. Resume existing work before creating replacement agents.

## 4. Coordinate ownership and communication

Assign one writer per file or shared mutable resource at a time. Use separate worktrees when useful, with an explicit integration plan. Serialize shared Git operations when agents use the same checkout.

Before editing, check whether another participant owns the affected area. If work overlaps:

1. Ask the affected workers to pause overlapping edits.
2. Inspect their current changes and preserve their work.
3. Choose an owner or define an ordered handoff.
4. Communicate the decision and confirm it before edits resume.

Do not revert another participant's changes merely because they were unexpected. Account for shared ports, databases, generated files, and other resources that worktrees do not isolate.

Before sending a message, verify the recipient's current session, membership in `goal_tab_id`, and assignment relationship. Send targeted messages containing the task ID, relevant evidence, the requested action, and any ownership change. Do not broadcast to visible, same-cwd, or idle agents. Share interface decisions with affected assigned workers promptly. Avoid repetitive status prompts.

Workers report to their assigned parent. Coordinate with another worker only when that relationship is part of the assignment and both remain in the same goal tab. Changes to scope, ownership, or shared interfaces must reach the orchestrator.

## 5. React to events

Use each relevant event to update the task ledger and decide whether action is needed:

- New or moved resources: refresh identity and ownership mappings against the goal tab. A resource outside it requires an explicit handoff before further coordination.
- Working: continue independent work and inspect meaningful progress.
- Blocked: first verify that the event belongs to an assigned worker still in the goal tab, then read the actual question or approval request. Resolve it within existing user authorization and applicable tool policies; request user input only when necessary.
- Idle or done: collect the task-specific result and verify it.
- Unknown, exit, timeout, or monitoring loss: re-establish identity, assignment, and goal-tab membership before reading live output. If the original session is gone, inspect its recorded artifacts and runtime state without adopting a replacement occupant. Verify the evidence before retrying or replacing anything.

Never send approval keys blindly or bypass a required human approval. Before retrying a prompt after a timeout, check whether it was already received to avoid duplicate work.

Prefer event-driven coordination and bounded waits. Do not block all progress waiting on one worker while other useful work is available.

## 6. Integrate and verify

Herdr status is an observation of agent lifecycle, not proof that an assignment succeeded. In particular, `--wait`, `idle`, and `done` do not establish task completion.

Require results tied to the assigned task ID:

- What changed and where.
- Validation performed and its outcome.
- Remaining issues or blockers.
- An artifact path or commit reference when applicable.

If terminal output is incomplete, have the worker save its report to an agreed file and read it directly.

Inspect the actual changes, integrate them coherently, and run checks appropriate to the combined result. Resolve failures or return focused follow-up work to the responsible worker.

Finish when the user's acceptance criteria are met and all required assignments are accounted for. Report the outcome, verification, and remaining limitations concisely. Preserve useful artifacts and leave unrelated agents and user-managed tabs intact.

## gisool tracing

Register this task's intended workflow with gisool before opening panes, then attach each pane to its step. Tracing is best-effort observation: if gisool is unavailable, continue orchestration and note the tracing gap. Intended skills are guidance for the agents, not restrictions; differences between the plan and actual skill use are feedback data.

Use the workspace containing the verified goal tab as `HERDR_WORKSPACE_ID` and `goal_tab_id` as `HERDR_TAB_ID`; never substitute the UI-focused tab. Read the local port from `~/.gisool/config.json` (`port`, default `8799`) and authenticate with `~/.gisool/token`. Keep the flow ID in the task ledger for recovery.

Before opening panes, adapt this example's spec name, step IDs, and intended skills to the task. Spec and step IDs are slugs of at most 64 characters; a spec has 1-50 unique steps, each with up to 10 intended skills. `together: true` means all listed skills are expected in that step; `false` means any one satisfies the intention. `expectTools` and `doneWhen` describe expected activity and completion without enforcing either.

```sh
GISOOL_PORT=$(jq -r '.port // 8799' ~/.gisool/config.json 2>/dev/null) || true
GISOOL_URL="http://127.0.0.1:${GISOOL_PORT:-8799}"
SPEC_NAME="task-workflow"
WORKFLOW_SPEC=$(jq -n --arg name "$SPEC_NAME" '{
  name: $name,
  steps: [
    {id: "implement", skills: ["programming"], together: false,
     expectTools: [], doneWhen: "Implementation is ready for review"},
    {id: "verify", skills: ["review-work"], together: false,
     expectTools: [], doneWhen: "Acceptance criteria are verified"}
  ]
}') || true

curl -fsS --connect-timeout 2 --max-time 5 -X POST "$GISOOL_URL/api/workflows" \
  -H "Authorization: Bearer $(cat ~/.gisool/token)" \
  -H 'Content-Type: application/json' \
  --data "$WORKFLOW_SPEC" || true

# Do not use curl -f here: HTTP 409 carries the existing flowId to reuse.
FLOW_RESPONSE=$(curl -sS --connect-timeout 2 --max-time 5 \
  -X POST "$GISOOL_URL/api/flows" \
  -H "Authorization: Bearer $(cat ~/.gisool/token)" \
  -H 'Content-Type: application/json' \
  --data "$(jq -n --arg workspaceId "$HERDR_WORKSPACE_ID" \
    --arg tabId "$HERDR_TAB_ID" --arg name "$SPEC_NAME" \
    '{workspaceId: $workspaceId, tabId: $tabId, spec: {name: $name}}')") || true
FLOW_ID=$(printf '%s' "$FLOW_RESPONSE" | jq -er '
  if .error == "flow_already_open" then .flowId
  elif .error == null then .id
  else empty end | select(type == "string" and length > 0)
') || true
```

A successful flow creation returns `id`; HTTP 409 returns `error: "flow_already_open"` and `flowId`. Reuse that `flowId` rather than opening another flow for the same workspace and tab. On recovery, reconcile the existing flow with the task ledger before mapping more panes. Other errors leave tracing unavailable; do not treat an error response as a flow ID.

Immediately after each `herdr pane split`, take the new pane ID from Herdr's response and set `PANE_ID` to that exact ID and `STEP_ID` to its declared step ID. Register the mapping before dispatching the step's assignment. Also map a reused pane when assigning it a step.

```sh
if [ -n "$FLOW_ID" ]; then
  curl -fsS --connect-timeout 2 --max-time 5 \
    -X POST "$GISOOL_URL/api/flows/$FLOW_ID/steps" \
    -H "Authorization: Bearer $(cat ~/.gisool/token)" \
    -H 'Content-Type: application/json' \
    --data "$(jq -n --arg paneId "$PANE_ID" --arg stepId "$STEP_ID" \
      '{paneId: $paneId, stepId: $stepId}')" || true
fi
```

Tell each pane's agent its step ID and intended skill names as part of the bounded assignment. For example: "Step implement intends programming as guidance; choose additional or different skills when they fit the task, and report what you used." For multi-skill steps, explain whether the listed skills are intended together or as alternatives. Keep the agent's judgment intact.

At the end of orchestration, after accounting for the assignments and recording the outcome, close the registered flow. Use the same cleanup when deliberately ending an interrupted task; leave unrelated flows alone.

```sh
if [ -n "$FLOW_ID" ]; then
  curl -fsS --connect-timeout 2 --max-time 5 \
    -X POST "$GISOOL_URL/api/flows/$FLOW_ID/end" \
    -H "Authorization: Bearer $(cat ~/.gisool/token)" \
    -H 'Content-Type: application/json' --data '{}' || true
fi
```

## References

Use installed help and schema for version-specific behavior. Consult these sources when additional context is needed:

- [Herdr agent automation](https://herdr.dev/docs/agent-automation/)
- [Herdr socket API and event subscriptions](https://herdr.dev/docs/socket-api/#event-subscriptions)
- [Original Korean walkthrough](https://blog.dnd.ac/herdr-terminal-workspace-for-ai-agents/)
