---
name: herdr-orchestrator
description: Coordinate coding agents through Herdr, selecting models for bounded parallel or sequential assignments, monitoring progress, managing edit ownership, and verifying integration and cleanup. Use when coordinating multiple agents through Herdr or when asked to act as a Herdr orchestrator.
keywords: ["Herdr", "다중 에이전트", "코딩 에이전트", "독립 작업", "위임", "분담", "pane orchestration", "multi agent coordination", "delegate independent work"]
---

# Herdr multi-agent orchestration

Herdr is a terminal workspace manager that lets agents discover other agents, create tabs and panes, send prompts, inspect output, and observe lifecycle events. Verify the actual connection and target session; do not assume the caller is inside Herdr or require HERDR_ENV=1 as a prerequisite.

Act as the orchestrator for the user's task. Own the outcome from planning through integration and verification.

When the user asks to use this skill for a task, treat that request as authorization to create the helper panes and start the agents needed for in-scope delegated work. Do not ask for separate approval for each pane or assignment. Merely searching, reading, translating, or editing this skill is not a request to launch agents. Follow higher-priority execution and delegation constraints; this skill does not override them.

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
- Consult the installed Herdr instructions with `herdr --skill` if they are not already available. Use CLI help and `herdr api schema --json` to verify commands, capabilities, and event names. Use that guidance for command mechanics; its generic topology defaults do not replace the goal mapping above.
- Use IDs returned by Herdr. Never infer IDs from position or numbering.

Use Herdr's agent controls for recognized agents and pane controls for ordinary shell processes. Create or identify an available shell pane before starting an agent there. Preserve the user's focus when layout commands support it.

## 2. Keep monitoring active

Before creating agents, dispatching assignments, or modifying tabs and panes, inspect and reuse the environment's existing monitor. Do not start a duplicate monitor when one already covers this task. Establish working observation through event delivery or bounded polling; do not assume a particular host hook, local path, or monitoring command exists.

Monitor agent discovery, status changes, exits, and relevant tab, pane, and layout lifecycle changes within `goal_tab_id`. Include newly created panes in that tab. General subscriptions may support identity recovery, but only goal-tab events are task notifications. Resolve events without tab information through verified topology, including the last verified mapping for a close event.

Ignore notifications from other tabs for task coordination. A `Herdr changes` notification is an observation, not an assignment or permission to prompt, answer, or take over another agent. When identity or tab membership is uncertain, refresh the mapping before acting.

Verify the target identities and goal-tab coverage, including assigned workers, and that observations are being delivered or inspected. A live monitor process or subscription acknowledgement alone does not establish coverage. Use the available tool's status and recovery controls. If no dedicated monitor tool exists, use supported Herdr event subscriptions. Discover actual event names instead of inventing them.

When using event subscriptions, establish the subscription before taking the initial state snapshot. Buffer events during the snapshot, then reconcile them with current state. After a disconnect, context recovery, or suspected event gap, restore observation and refresh the snapshot before relying on cached state. Revalidate unresolved identities before attempting subscription recovery for those targets.

Consume events throughout the task, including while doing your own work. A background process writing logs is insufficient unless those events are actually delivered to you or inspected at bounded intervals.

If streaming is unavailable, use bounded polling and state that monitoring is degraded. If neither works, continue useful local work without creating workers or dispatching further assignments. Restore observability before further orchestration mutations.

## 3. Delegate bounded work

At task start and each meaningful phase transition, identify bounded work to delegate. Sequential assignments are useful too: a worker can implement an agreed investigation result or review a completed change. Select who should perform the work by capability and the cost of execution, handoff, and verification; use dependencies to decide when it can start. Keep trivial work or inseparable immediate edits local when separation costs more than it saves, and state that reason briefly.

Before selecting a worker's model, read [the model catalog](references/model-catalog.md). It separates observed model information from maintained assignment policy. For an MCP-served skill, resolve this relative reference against the skill directory and read it from the same server; do not assume a local copy. Reuse the loaded catalog while its version and context remain available. No model-list API or dedicated routing service is required.

Choose a model and reasoning effort that meet the assignment's acceptance criteria, starting with the catalog's suitable lower-cost preferences. Reassess the choice when reusing a worker for a different assignment. Explicit user model constraints take precedence. Record the model, effort, short selection reason, and catalog source version or available digest in the task ledger; use existing source/deployment identifiers rather than inventing a separate version scheme.

Pass the selected model and effort explicitly using the installed agent's supported options. Check the actual session values through available session metadata or output before dispatch when possible. Correct a mismatch before continuing; if a value cannot be observed, record it as unverified rather than claiming confirmation. Do not silently accept a global default or substitute another model.

Respond to failures according to their cause:

- Confirmed model unavailability: choose a suitable catalog alternative within the user's constraints, or report the specific limitation.
- Command or tool error: repair the execution method. Missing task context: provide the missing information.
- Repeated reasoning errors despite sufficient context: apply the catalog's escalation conditions, carrying forward findings and failure evidence.
- Uncertain execution or timeout: reconcile the existing assignment before retrying or replacing it.

Record model or effort changes and their reason. A different model does not by itself fix missing context or broken tools.

After establishing monitoring and inspecting current assignments, reuse an available shell pane or a ready worker assigned to this task inside `goal_tab_id`. If none is suitable, create a sibling pane in that goal tab and start a helper there. The absence of an existing idle pane is a reason to create one, not a reason to reuse another tab's agent or skip useful delegation. Preserve the assigned working directory and the user's focus, using explicit verified session/pane IDs. When operating from outside Herdr, establish the intended goal tab and target pane explicitly; do not assume the UI-focused pane belongs to this task.

Start with one useful helper and add more when each has independent work and a clear owner. Do not require the user to request a pane count or split work merely to increase the number of panes.

Once a worker finishes, verify its result and check the goal's remaining work. Assign any required next step, including dependent work, and confirm acceptance; reuse an appropriate assigned pane when useful. Continue your own work and consume monitoring events while dependencies run. If a concrete connection, monitoring, or policy restriction prevents delegation, proceed locally and state the specific reason briefly.

For each assignment, provide:

- A unique task ID and the responsible orchestrator.
- The exact goal tab and parent session/pane to report to.
- The objective, relevant context, and dependencies.
- The repository/worktree and files or resources the worker may modify.
- The selected model and effort, and any relevant escalation conditions.
- Constraints, expected deliverables, and acceptance criteria.
- Required validation and where to report results.
- A requirement to report blockers and ownership conflicts promptly.

Confirm that the worker accepted the assignment. A successful prompt submission alone is not acceptance.

Maintain a compact task ledger containing `goal_tab_id`, the parent session/pane, and each assigned worker's session, pane, working directory, model selection and verification, ownership, dependencies, and progress. A short entry per assignment is enough. Keep task progress separate from Herdr's observed agent status. Membership tracking does not itself enable automatic continuation prompts.

Persist enough coordination state to recover assignments and pending decisions after context loss. Resume existing work before creating replacement agents.

## 4. Coordinate ownership and communication

Assign one writer per file or shared mutable resource at a time. For Git repository work, inspect the canonical checkout, existing changes, base commit, and worktree list before assigning writers. Give each concurrent writing worker its own branch and worktree from an explicitly chosen base. Read-only workers may share a checkout; non-repository work needs no artificial worktree.

Record each writer's base commit, branch, worktree, owned files, and integration target. The parent owns integration and serializes shared Git operations. Workers deliver focused commits and validation evidence; the parent reviews and integrates them while preserving unrelated changes, then verifies the combined result. Worktree separation does not replace file ownership.

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
- Working: continue independent work. If an expected progress report is missing or the status conflicts with results, inspect available session activity, output, or artifacts. A stale `working` label alone is not a reason to keep waiting, resend an assignment, or replace a worker.
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

After verifying each result, check the whole goal. If work remains, connect it to an owner and confirm acceptance. Finish when the user's acceptance criteria are met and all required assignments are accounted for; a worker's final report alone does not close the goal.

Preserve required changes, untracked deliverables, reports, and validation evidence before retiring resources created for this task. Verify that no active assignment or process still uses them, then close task-created panes and processes through their supported lifecycle controls and remove temporary worktrees with `git worktree remove`. The parent verifies cleanup, including resources created by its workers. Keep integrated source recoverable in the canonical repository or intended handoff location.

Do not close a resource merely because it is idle. Leave unrelated agents and user-managed tabs intact. For interrupted, paused, or deliberately retained work, record the remaining steps, retained resource paths/IDs, retention reason, and resume or removal condition. Before finishing, check that every task-created temporary worktree and pane is removed or has a recorded retention reason. Report the outcome, verification, and remaining limitations concisely.

## skillar tracing

Register this task's intended workflow with skillar before opening panes, then attach each pane to its step. Tracing is best-effort observation: if skillar is unavailable, continue orchestration and note the tracing gap. Intended skills are guidance for the agents, not restrictions; differences between the plan and actual skill use are feedback data.

Use the workspace containing the verified goal tab as `HERDR_WORKSPACE_ID` and `goal_tab_id` as `HERDR_TAB_ID`; never substitute the UI-focused tab. Use `SKILLAR_HOME` when set, otherwise `~/.skillar`; if the default directory is absent, use the legacy `~/.gisool` directory (an explicit `SKILLAR_HOME` always wins). Read its `config.json` (`port`, default `8799`) and authenticate with its `token`. Keep the flow ID in the task ledger for recovery.

Before opening panes, adapt this example's spec name, step IDs, and intended skills to the task. Spec and step IDs are slugs of at most 64 characters; a spec has 1-50 unique steps, each with up to 10 intended skills. `together: true` means all listed skills are expected in that step; `false` means any one satisfies the intention. `expectTools` and `doneWhen` describe expected activity and completion without enforcing either.

```sh
if [ -z "${SKILLAR_HOME:-}" ]; then
  SKILLAR_HOME="$HOME/.skillar"
  if [ ! -d "$SKILLAR_HOME" ] && [ -d "$HOME/.gisool" ]; then
    SKILLAR_HOME="$HOME/.gisool"
  fi
fi
SKILLAR_PORT=$(jq -r '.port // 8799' "$SKILLAR_HOME/config.json" 2>/dev/null) || true
SKILLAR_URL="http://127.0.0.1:${SKILLAR_PORT:-8799}"
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

curl -fsS --connect-timeout 2 --max-time 5 -X POST "$SKILLAR_URL/api/workflows" \
  -H "Authorization: Bearer $(cat "$SKILLAR_HOME/token")" \
  -H 'Content-Type: application/json' \
  --data "$WORKFLOW_SPEC" || true

# Do not use curl -f here: HTTP 409 carries the existing flowId to reuse.
FLOW_RESPONSE=$(curl -sS --connect-timeout 2 --max-time 5 \
  -X POST "$SKILLAR_URL/api/flows" \
  -H "Authorization: Bearer $(cat "$SKILLAR_HOME/token")" \
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
    -X POST "$SKILLAR_URL/api/flows/$FLOW_ID/steps" \
    -H "Authorization: Bearer $(cat "$SKILLAR_HOME/token")" \
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
    -X POST "$SKILLAR_URL/api/flows/$FLOW_ID/end" \
    -H "Authorization: Bearer $(cat "$SKILLAR_HOME/token")" \
    -H 'Content-Type: application/json' --data '{}' || true
fi
```

## References

Use installed help and schema for version-specific behavior. Consult these sources when additional context is needed:

- [Herdr agent automation](https://herdr.dev/docs/agent-automation/)
- [Herdr socket API and event subscriptions](https://herdr.dev/docs/socket-api/#event-subscriptions)
- [Original Korean walkthrough](https://blog.dnd.ac/herdr-terminal-workspace-for-ai-agents/)
