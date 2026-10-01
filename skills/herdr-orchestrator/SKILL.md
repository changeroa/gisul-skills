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

## 1. Discover the environment

Before coordinating work:

- Identify your current session, workspace, tab, pane, and repository. Verify that Herdr is available and connected before attempting orchestration.
- Inspect existing agents and their assignments before creating helpers.
- Distinguish agents participating in this task from unrelated sessions. Visibility alone does not authorize taking over another agent.
- Consult the installed Herdr instructions with `herdr --skill` if they are not already available. Use CLI help and `herdr api schema --json` to verify commands, capabilities, and event names.
- Use IDs returned by Herdr. Never infer IDs from position or numbering.

Use Herdr's agent controls for recognized agents and pane controls for ordinary shell processes. Create or identify an available shell pane before starting an agent there. Preserve the user's focus when layout commands support it.

## 2. Keep monitoring active

MUST enable the available monitoring tool before creating agents, dispatching parallel work, or modifying tabs and panes.

Monitor agent discovery, status changes, exits, and relevant workspace, tab, pane, and layout lifecycle changes. Include newly created resources and every workspace participating in this task.

Verify that monitoring is active; intending to enable it is insufficient. If no dedicated monitor tool exists, use supported Herdr event subscriptions. Discover actual event names instead of inventing them.

Establish the subscription before taking the initial state snapshot. Buffer events during the snapshot, then reconcile them with current state. After a disconnect, context recovery, or suspected event gap, restore monitoring and refresh the snapshot before relying on cached state.

Consume events throughout the task, including while doing your own work. A background process writing logs is insufficient unless those events are actually delivered to you or inspected at bounded intervals.

If streaming is unavailable, use bounded polling and state that monitoring is degraded. If neither works, continue useful local work without starting additional parallel tasks. Restore observability before further orchestration mutations.

## 3. Delegate bounded work

Actively look for parallel work at the start and at each meaningful phase transition. When a bounded subtask can progress independently while you do useful work, delegate it rather than completing everything serially. Suitable examples include investigating a separate component, implementing independently owned files, or reviewing a prepared change while you work on integration.

After establishing monitoring and inspecting current assignments, reuse an available shell pane or ready agent belonging to this task when suitable. If none is suitable, create a sibling pane in the current task's tab and start a helper there. The absence of an existing idle pane is a reason to create one, not a reason to skip delegation. Preserve the task's working directory and the user's focus, using explicit session/pane IDs discovered from Herdr. When operating from outside Herdr, establish the intended task session and target pane explicitly; do not assume the UI-focused pane belongs to this task.

Start with one useful helper and add more when each has independent work and a clear owner. Do not require the user to request a pane count. Keep short tasks and work with inseparable shared edits local; do not split work merely to increase the number of panes.

Once a worker finishes, verify its result and reuse that pane for the next independent assignment. Continue your own work and consume monitoring events instead of waiting idly. If no useful parallel work exists or a concrete connection, monitoring, or policy restriction prevents it, proceed locally and state the specific reason briefly.

For each assignment, provide:

- A unique task ID and the responsible orchestrator.
- The objective, relevant context, and dependencies.
- The repository/worktree and files or resources the worker may modify.
- Constraints, expected deliverables, and acceptance criteria.
- Required validation and where to report results.
- A requirement to report blockers and ownership conflicts promptly.

Confirm that the worker accepted the assignment. A successful prompt submission alone is not acceptance.

Maintain a compact task ledger mapping task IDs to agents, current pane IDs, working directories, ownership, dependencies, and progress. Keep task progress separate from Herdr's observed agent status.

Persist enough coordination state to recover assignments and pending decisions after context loss. Resume existing work before creating replacement agents.

## 4. Coordinate ownership and communication

Assign one writer per file or shared mutable resource at a time. Use separate worktrees when useful, with an explicit integration plan. Serialize shared Git operations when agents use the same checkout.

Before editing, check whether another participant owns the affected area. If work overlaps:

1. Ask the affected workers to pause overlapping edits.
2. Inspect their current changes and preserve their work.
3. Choose an owner or define an ordered handoff.
4. Communicate the decision and confirm it before edits resume.

Do not revert another participant's changes merely because they were unexpected. Account for shared ports, databases, generated files, and other resources that worktrees do not isolate.

Send targeted messages containing the task ID, relevant evidence, the requested action, and any ownership change. Share interface decisions with affected workers promptly. Avoid repetitive status prompts.

Workers may coordinate within their assignments, but changes to scope, ownership, or shared interfaces must reach the orchestrator.

## 5. React to events

Use each relevant event to update the task ledger and decide whether action is needed:

- New or moved resources: refresh identity and ownership mappings.
- Working: continue independent work and inspect meaningful progress.
- Blocked: read the actual question or approval request. Resolve it within existing user authorization and applicable tool policies; request user input only when necessary.
- Idle or done: collect the task-specific result and verify it.
- Unknown, exit, timeout, or monitoring loss: inspect current output, artifacts, and runtime state before retrying or replacing anything.

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

## References

Use installed help and schema for version-specific behavior. Consult these sources when additional context is needed:

- [Herdr agent automation](https://herdr.dev/docs/agent-automation/)
- [Herdr socket API and event subscriptions](https://herdr.dev/docs/socket-api/#event-subscriptions)
- [Original Korean walkthrough](https://blog.dnd.ac/herdr-terminal-workspace-for-ai-agents/)
