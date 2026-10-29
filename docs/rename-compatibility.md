# Iyen catalog and Skillar runtime names

The catalog repository is `changeroa/iyen-skills`; its runtime is
`changeroa/skillar`. New catalog resources use `skill://skillar/iyen/…` and
`pack://skillar/iyen/…`. Local MCP resources retain
`skill://local/<rootId>/…`, including configured root IDs.

`aliases.json` preserves the imported `skill://gisul/codex/…` names and former
`skill://gisul/gisul/…` catalog names as redirects to the current skill URIs.
New release manifests and pack definitions use the new names. Retained pack
artifacts can still be verified under their original URI without rewriting
their bytes or digests.

Herdr tracing uses `SKILLAR_HOME`, defaulting to `~/.skillar`. When that default
directory does not exist, the instructions use the existing `~/.gisool`
configuration and token. An explicit `SKILLAR_HOME` takes precedence.

The legacy SSH release command selects the existing
`~/Library/LaunchAgents/com.iyendev.skillar-mcp.plist`, falling back to
`com.iyendev.gisul-mcp.plist` only when the new file is absent. Its launchd label
follows that selection. The bearer file similarly prefers
`~/.config/secrets/skillar-mcp-bearer-token` and otherwise retains the existing
`gisul-mcp-bearer-token`. No credentials or immutable release files are moved.
Override these choices with `SKILLAR_LAUNCHD_LABEL` (bare label),
`SKILLAR_LAUNCHD_PLIST` and `SKILLAR_BEARER_TOKEN_FILE`. Custom plist filenames
require an explicit label. Missing or invalid explicit files fail instead of
silently selecting another installation. `release-skills.mjs` forwards these
three overrides to its target host; their paths refer to that host. Its remote
runtime root prefers an existing `~/.skillar`, then an existing `~/gisul`;
`SKILLAR_REMOTE_ROOT` overrides that choice.

Device checks, installed-plugin smoke checks and the OpenClaw configurator prefer
the enabled `skillar@personal` plugin and otherwise use the enabled
`gisul@personal` plugin's actual cache, loader and MCP configuration. Device
comparison accepts historical `gisul` snapshot fields without relabeling stored
evidence. MCP smoke checks use the selected server's actual name. New and legacy
event-log environment variables point to the same synthetic log directory so
existing bridges/exporters can read it.

An existing OpenClaw `gisul` registration remains usable by the smoke command.
The configurator's `--check` reports it; `--install` requires explicit migration
instead of silently adding a second registration. To migrate, retain its current
configuration for rollback, retire that registration using the installed
OpenClaw version's supported commands, install/probe `skillar`, and use the
supported reload lifecycle for active agents. Changing the filesystem name alone
does not migrate a plugin registration or the external collector's tool-name
support.

New pinned MCP reads use the runtime's `app.skillar/commit` metadata key.

The following old names are intentional:

- `migration/`, release changelogs, dated deployment/evaluation records and the
  README artwork's original prompt retain historical identities and hashes.
  GitHub links in documentation follow the renamed repositories.
- Frozen evaluation cases and fixtures keep their original inputs. Preparation
  accepts the old `gisul_error` field; scoring and export accept historical
  `gisulEvents` results as well as new `skillarEvents` results.
- `arkpoint-gisul`, `Ark-Point/gisul*` and the pinned `arkpoint-ux-qa`
  `source_uri` refer to external team resources or their original provenance.
- Publication secrets accept previous `GISUL_*` names while preferring
  `SKILLAR_*`. The endpoint requires explicit `SKILLAR_RELEASE_BASE_URL`;
  `GISUL_RELEASE_BASE_URL` is never a fallback. Publication is manual only.
- `metadata.gisul`, `gisul_join` and the quality report's related fields belong
  to the external `langfuse-masked` collector contract. They remain unchanged.
- The former personal `gisul-mcp.changeroa.workers.dev` endpoint and
  `gisul.iyendev.com` domain are retired. Their names remain in historical
  evidence, not active publication configuration. The primary runtime is
  npm-installed Skillar with a local catalog.
- The retired `com.iyendev.gisul-sleep-diagnostic-20260917` observer and ignored
  `gisulPlugin` manifest field identify legacy diagnostics.

CI's runtime SHA is a separate dependency pin. Advance it to the reviewed,
merged Skillar runtime commit when integrating the coordinated rename; do not
replace historical content hashes to make names appear current.
