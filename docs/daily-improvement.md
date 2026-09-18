# Daily improvement candidates

`scripts/daily-improvement.mjs CONFIG [YYYY-MM-DD]` first runs the completed-day
quality audit. A failed, incomplete or empty population records `quality_blocked`
and makes no model call or PR. A valid day samples up to `maxTraces` roots evenly
by time, preserving both ordinary and failed outcomes. Sampling and truncation
limits accompany every candidate. The source is the project's already-masked
Langfuse data; raw local conversation stores are not read.

The operator JSON must set `projectId`, `githubRepo` (`changeroa/gisul-skills`),
`model`, `reasoning`, `maxRunSeconds` (30–1800), `maxTraces` (1–20),
`maxInputBytes` (1000–100000), and `scheduleHost`. Select the model and duration
budget explicitly. These are input/time bounds, not a dollar-cost guarantee.
Set `enableModelAnalysis: true` after the prerequisite quality/observation gate.
Set `publishDraftPR: true` and the intended `ghConfigDir` to enable draft PRs.
Without those booleans, the respective stage is disabled. `outputRoot` defaults
to ignored `eval/out/improvement/`; keep the config and generated data private.

The prerequisite is the completed-day audit in [quality.md](quality.md), plus
IYEN-44's three actual scheduled days with no missing input. Historical backfills
do not establish the observation period. Start from a disabled operator config:

```json
{
  "projectId": "cmu275pqc00i8ad0d79dddjgk",
  "githubRepo": "changeroa/gisul-skills",
  "model": "CHOOSE_MODEL",
  "reasoning": "medium",
  "maxRunSeconds": 300,
  "maxTraces": 5,
  "maxInputBytes": 30000,
  "scheduleHost": "EXACT_OUTPUT_OF_HOSTNAME",
  "enableModelAnalysis": false,
  "publishDraftPR": false,
  "ghConfigDir": "/Users/iyen/.config/gh-gisul-dev-tools"
}
```

Replace the model and hostname placeholders before enabling. Authentication uses
the existing Langfuse credential loader documented in `quality.md`, the owner's
Codex login, and the selected GitHub configuration; no secret belongs in this JSON.

Analysis uses `codex exec` with an explicit model/reasoning level, ignored user
config/rules, read-only sandbox, and disabled app/plugin/hook/browser/shell/agent
tools. It receives the candidate agent-improvement guidance and sampled data in
stdin and returns structured proposals. The model never performs publication.
The wrapper rejects citations outside the sampled trace IDs, creates only
`eval/candidates/<date>.md` in a separate worktree, and opens a draft PR. Existing
PRs are read back before retrying creation. Nothing is merged or promoted.

The model-start receipt prevents an interrupted or failed call from silently
running again. Inspect its logs and response before an explicit retry; do not
erase receipts to make the schedule appear successful. Concurrent runs of the
same date stop at its lock. A generated response is reused only with the same
date, project, model and reasoning. A dirty candidate worktree requires inspection.
Receipts and logs live in `<outputRoot>/<date>/`: `status.json`,
`model-started.json`, `input.json`, `response.json`, `events.jsonl` and
`model.stderr.log`. An intentional new model attempt must retain the entire old
directory and select a new `outputRoot`, initially with `publishDraftPR: false`.
It is a new budgeted attempt, not evidence of another scheduled day. An abandoned
lock records its host/PID in `lock/owner.json`; confirm that process has ended
before removing only the stale lock.

On the selected macOS host with Asia/Seoul system timezone:

```sh
node scripts/install-improvement-schedule.mjs --render /absolute/operator-config.json /tmp/improvement.plist
node scripts/install-improvement-schedule.mjs --install /absolute/operator-config.json
```

The schedule runs at 09:00 and selects the previous Korean calendar day. Use a
durable checkout, not a worktree about to be removed. Sleeping/offline hosts can
delay execution. The existing read-only quality schedule is preserved; this job
uses its own checkpoints and does not change the bounded MVP completion writer.

Verify with `launchctl print gui/$(id -u)/com.iyendev.dev-tools-daily-improvement`
and the `schedule.stdout.log` / `schedule.stderr.log` files in `outputRoot`.
To disable, use `launchctl disable gui/$(id -u)/com.iyendev.dev-tools-daily-improvement`
and `launchctl bootout gui/$(id -u)/com.iyendev.dev-tools-daily-improvement`.
Rerunning `--install` enables and reloads the selected job. A qualifying day needs
the real scheduled invocation, its complete quality report, model receipt,
candidate with trace citations and the draft PR readback. Record three distinct
consecutive actual days for IYEN-48; IYEN-49 separately requires human-rated
evaluation and promotion decisions.

No model run, draft PR or recurring analysis has been claimed by the code tests.
The September 17 production quality gate still fails, and the execution host/model
budget are unselected. The schedule is therefore not installed. Three actual
consecutive candidate-producing days and human evaluation/promotion remain open
requirements of IYEN-48 and IYEN-49.
