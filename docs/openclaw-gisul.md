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

## Collector source and deployment

The collector source is now the private
[langfuse-masked repository](https://github.com/changeroa/langfuse-masked/tree/6e4a2c752fa047db8c4119a3fdd7b33dfb4b7ba9/plugins/openclaw).
The permanent local source repository is `/Users/iyen/dev-tools/langfuse-masked`.
Version 3.1.0 at commit `6e4a2c752fa047db8c4119a3fdd7b33dfb4b7ba9` imports the
earlier `3970a837` candidate, handles native Codex tool-result envelopes, and
labels explicitly configured verification sessions. Current-turn successful
loads attach URI/release/commit/digest to `metadata.gisul.loads`; errors,
contradictory call IDs and clipped JSON remain partial joins. Native run IDs
provide turn identity. Historical legacy IDs remain unknown in quality audits.

[PR #3](https://github.com/changeroa/langfuse-masked/pull/3) passed GitHub CI
(77 existing tests and 11 OpenClaw tests) before deployment on 2026-09-22.
The runtime resides at
`/Users/iyen/.local/share/dev-tools/openclaw-langfuse/6e4a2c752fa047db8c4119a3fdd7b33dfb4b7ba9`.
Only its explicit plugin load path and dedicated synthetic session configuration
were changed. Other plugins, credentials, the configured default model and the
existing queue were preserved. A supported restart waited for active work to
drain; the running Gateway loaded this version with one `agent_end` hook.
The previous `/Users/iyen/agents/openclaw-langfuse` installation remains for
rollback. Restore its load path and restart with the same drain behavior to
roll back; preserve the queue and unrelated configuration.

## Actual Gateway acceptance

The configured `openai/gpt-5.6-luna` model performed real gisul search, load and
supporting-file reads through the Gateway. [The Langfuse trace](https://jp.cloud.langfuse.com/project/cmu275pqc00i8ad0d79dddjgk/traces/a4ab2e12bcf5cb183334777151efe788)
has 10 observations, three tool results and `gisul_join=complete`. Both the
trace and root observation contain these values, independently checked through
the API against the actual tool outputs:

| Field | Value |
| --- | --- |
| Native Gateway run ID | `f4883fc3-aee6-4074-9f1a-e50732721420` |
| Skill | `skill://gisul/gisul/dont-make-me-think/SKILL.md` |
| Supporting file | `references/sources-and-testing.md` (1,748 characters) |
| Release | `20260922.25` |
| Content commit | `8ac9e71bd695cb96a59ad76eebcc202444799785` |
| Manifest digest | `sha256:7f89d8d826ec66bf4d9f3fb364e76abd4ea47e4c982ec7981268e7545fff8be6` |
| Worker server commit | `bc6ba43045fb6303c3b1a631e28a40381be63ad2` |

This is a real model/Gateway run explicitly labeled synthetic via its dedicated
session key, so daily production quality excludes it. It is not a handcrafted
hook fixture or evidence of skill-recommendation quality. The delivery queue
retained all 6,762 previous IDs and had zero pending entries after verification.
Local receipts are retained under
`/Users/iyen/dev-tools/session-notes/trace-quality-20260922/`.
IYEN-54 is complete; historical quality failures and scheduled-operation proof
remain separate acceptance conditions.
