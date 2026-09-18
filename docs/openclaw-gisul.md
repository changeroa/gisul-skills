# OpenClaw gisul connection

Use the same verified Worker content through a local stdio bridge. The bridge
keeps digest verification and exposes only search, load and supporting-file reads.
It does not restore the retired SSH/server-origin path.

```sh
node scripts/configure-openclaw-gisul.mjs --check
node scripts/configure-openclaw-gisul.mjs --install
openclaw mcp probe gisul --json
```

The installer takes the selected local Codex plugin's bundled runtime and HTTPS
configuration. It retains the runtime under a content-hash directory outside the
plugin cache so a later Codex update cannot remove OpenClaw's executable. The
reader credential remains in its existing owner-only external file. It uses
OpenClaw's native `mcp add` probe/save flow, preserves other server definitions and
refuses to replace a different existing gisul registration. Updating an installed
runtime is an explicit replacement operation after checking the existing config.

This was implemented against OpenClaw 2026.9.3's local `docs/cli/mcp.md` contract.
The command proves the configured server's capabilities, not an agent's skill
selection. It does not restart the Gateway or an active agent. OpenClaw documents
`mcp reload` as affecting only the current CLI process; existing agent processes
must pick up the new config through their own supported reload/restart lifecycle.

The Mac's OpenClaw collector is a separate Git repository at
`/Users/iyen/agents/openclaw-langfuse`, not the Codex exporter repository. Its
IYEN-54 change is commit `3970a83769f5f8a7ffcd292383d78f2fddc31c97`
in the separate `work/devtools-gisul-trace-20260918` worktree at
`/Users/iyen/dev-tools/worktrees/linear-triage-20260918/openclaw-langfuse`.
It joins successful current-turn gisul loads into `metadata.gisul.loads`, records
partial joins for errors/missing metadata and preserves release strings such as
`20260917.10` through masking. Deploying that collector and observing a fresh
Gateway turn remain separate from its source tests and synthetic canary.
