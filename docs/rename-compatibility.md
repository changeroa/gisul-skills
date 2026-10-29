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

The following old names are intentional:

- `migration/`, release changelogs, dated deployment/evaluation records and the
  README artwork's original prompt retain historical identities and hashes.
  GitHub links in documentation follow the renamed repositories.
- Frozen evaluation cases and fixtures keep their original inputs. Preparation
  accepts the old `gisul_error` field; scoring and export accept historical
  `gisulEvents` results as well as new `skillarEvents` results.
- `arkpoint-gisul`, `Ark-Point/gisul*` and the pinned `arkpoint-ux-qa`
  `source_uri` refer to external team resources or their original provenance.
- Publication workflow variables and secrets accept the previous `GISUL_*`
  names while preferring `SKILLAR_*`.
- `metadata.gisul`, `gisul_join` and the quality report's related fields belong
  to the external `langfuse-masked` collector contract. They remain unchanged.
- The deployed `gisul-mcp.changeroa.workers.dev` endpoint and
  `gisul.iyendev.com` domain remain deployment configuration. Renaming source
  references does not establish a new live endpoint.
- The retired `com.iyendev.gisul-sleep-diagnostic-20260917` observer and ignored
  `gisulPlugin` manifest field identify legacy diagnostics.

CI's runtime SHA is a separate dependency pin. Advance it to the reviewed,
merged Skillar runtime commit when integrating the coordinated rename; do not
replace historical content hashes to make names appear current.
