# Project runtime template

This Node 24+ template runs a local example on macOS/Linux. It starts missing
services, reuses healthy ones and verifies account identity through a real login
response. The example reproduces a login that stops at a confirmation screen.
It is a test fixture, not an authentication implementation for deployment.

From this directory:

```sh
npm ci
npx playwright install chromium
export RUNTIME_PORT_BASE=43100
scripts/dev/ensure-ready
scripts/dev/ensure-ready
scripts/dev/verify-flow login-no-interstitial
```

The second readiness call reports the same PID and `reused: true`. It still checks
health and login identity. `ready.json` contains verified user/workspace IDs and
omits credentials. The fixture defaults to `fixture@example.test` and
`local-fixture-only`; `RUNTIME_TEST_EMAIL` and `RUNTIME_TEST_PASSWORD` override
both fixture-server and client credentials when the server starts. Restart after
changing them. These defaults are for this local example only.
Readiness exits 0 on success, 2 with `unmet` entries,
or 1 for configuration/command errors. Flow verification exits 0/1 and saves
`result.json`, a screenshot and a Playwright trace under `.agent-runtime/verify/`.

Reproduce the defect and then remove it, using the same flow:

```sh
touch .agent-runtime/interstitial
scripts/dev/verify-flow login-no-interstitial
rm .agent-runtime/interstitial
scripts/dev/verify-flow login-no-interstitial
scripts/dev/ensure-ready --stop
```

The defective run fails on `/confirm`; the fixed run reaches `/dashboard`.
This reproduces the reported failure mode locally; it does not claim to test the
unavailable historical product commit. Each run retains its own evidence.

## Apply to a project

Copy `scripts/dev/`, `runtime.config.mjs` and `ready.schema.json` into the selected
repository. Add `@playwright/test` and `yaml` from this template's `package.json`
using that project's package manager, then install Playwright's Chromium browser.
Adapt `runtime.config.mjs`, the flow YAML and scoped AGENTS
references to that project's actual commands, health endpoint and contract files.
Keep its existing lockfile and package manager. The application-specific login
adapter in `runtime.config.mjs` (`accounts[].credentials` and `accounts[].login`)
must return `user_id` and `workspace` from the server response; never derive
them from the email or role. Set `expectedWorkspace` when one workspace is required.

Health JSON must include `project`, `env`, `runtime_root`, `service`, and `instance`
from the corresponding `RUNTIME_*` process environment. This prevents a server in
another worktree from being mistaken for this one. Choose a different
`RUNTIME_PORT_BASE` in each worktree. `--restart` and `--stop` only signal an identified
instance matching this worktree's saved ownership receipt. Services use argv
arrays, never shell command strings; their stdout/stderr goes to local logs.
Shutdown waits for the owned process group to exit and the health endpoint to
close before reporting success or starting its replacement. Slow cleanup times
out with the ownership receipt retained for diagnosis.

Optional `dependencies` accepts `lockfile`, `checkPath` and an install `command`
array. Installation runs when the lockfile hash changes or `checkPath` is absent.
Optional `preflight` is a list of argv arrays for toolchain and migration checks;
they must be safe to rerun. This example uses Node's built-in HTTP server and has
no database or application dependency installation step.

Use dedicated test credentials via the project's existing environment loader.
Keep `.agent-runtime/` ignored: browser traces can contain test credentials and
responses. An interrupted readiness command leaves `ensure.lock/owner.json`;
check that PID before removing a stale lock. Concurrent readiness calls fail
instead of racing to start the same port. Run `--stop` before discarding a worktree.
If a saved PID is alive but its health endpoint cannot confirm ownership, stopping
fails. Inspect `.agent-runtime/processes.json`, the process command and service log;
terminate it manually only after confirming that it belongs to this worktree.

The example's root AGENTS points to both scripts; `example/apps/api/AGENTS.md`
points to the same `image_ref` schema as `ready.json.contracts`. Replace that sample
contract with the selected project's contracts. The adoption skill lives at
`eval/candidates/workflows/skills/project-runtime/SKILL.md`; it remains outside the
live catalog until the [evaluation gate](../../eval/README.md) permits promotion.

Browser evidence uses Playwright's [isolated contexts](https://playwright.dev/docs/browser-contexts)
and [tracing API](https://playwright.dev/docs/api/class-tracing).
