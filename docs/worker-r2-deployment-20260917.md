# Worker/R2 deployment, 2026-09-17

The production endpoint is `https://gisul.iyendev.com/mcp`. Worker `gisul-mcp`
serves the private `gisul-skills-releases` bucket directly in Cloudflare account
`8277c1acc712e4a9d00479255015c200` (iyen / iyen.team@gmail.com).
The origin deployment at `/Users/iyen/gisul` was preserved and is no longer on
the Worker's serving path. The bucket has no public access.

## Initial activation evidence

| Item | Verified identity |
| --- | --- |
| Runtime source | `132cadd6ddc27f3f8dde763da8e1b67fec34dc96` |
| Cloudflare version | `49b63e31-0b2d-42eb-8aab-006a7864ebf6` at 100% |
| Initial content commit | `6dccec5d232a1a935dbfb12bab2ff2fcccc5087d` |
| Initial release | `20260917.6` |
| Inventory digest | `sha256:24abe40b5cd96b56fb24dc66074bdc1ba8d2d3e447b38477a12371708402f37e` |
| Publication | [Actions run 35196744614](https://github.com/changeroa/gisul-skills/actions/runs/35196744614) |
| Installed gisul | `0.1.0+codex.20260917080301` |
| Installed masked exporter | `0.1.0+codex.20260917074503`, source `171fcdfdb6c7707ab2d16d81ec4ea6136aaaab47` |

Actions checked all 252 content files against their Git objects and all 254
inventoried R2 files before activation. The published catalog has 33 skills and
retains dont-make-me-think from the accepted `20260917.3` content. A direct R2
inventory download independently matched the receipt's digest. Worker tests
passed 35/35, server tests 39/39, skills tests 22/22 and exporter tests 75/75;
TypeScript/LSP and corresponding repository CI also passed.

The actual installed plugin searched, loaded and read supporting files at the
production HTTPS endpoint. Its [synthetic Langfuse evidence](https://jp.cloud.langfuse.com/project/cmu275pqc00i8ad0d79dddjgk/traces/d3a73ee5aac4cbcf5863b2db892fe45d)
matches the retained installed-plugin receipt.
The canary verifies the release/commit, manifest digest and exact connection
join, with six expected observations unchanged after a repeated hook.
This is integration evidence, not a model-selection evaluation or E14 audit.

## Continuing source and operations

Permanent GitHub checkouts are `/Users/iyen/dev-tools/gisul`,
`/Users/iyen/dev-tools/gisul-skills` and `/Users/iyen/dev-tools/langfuse-masked`.
The exact deployed identities above are distinct from later documentation commits.
The Actions publication origin is now `https://gisul.iyendev.com`; subsequent main
changes use the [same gated publisher and rollback workflow](r2-publication.md).

GitHub uses task-only `GH_CONFIG_DIR=/Users/iyen/.config/gh-gisul-dev-tools` with
the same environment in repository-local Git credential helpers. Global GitHub
authentication was not changed. The plugin's reader token is external to its
source/cache at `/Users/iyen/.config/gisul-worker-dev-tools/mcp-bearer`, mode 0600.
Cloudflare account OAuth and the distinct publisher credential are separate.

Work was performed in Herdr w3:p5 with its own event monitor. w3:p2 was not touched.
No temporary worktree or competing E14 completion writer was created. E14 remains
subject to the existing laptop audit after 2026-09-18 09:10 KST; the MVP parent
must stay open until the actual completed-day gate passes.
