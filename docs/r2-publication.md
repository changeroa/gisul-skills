# Optional manual publication to private R2

The primary setup is Skillar installed from npm with a local catalog. The former
personal Cloudflare deployment has been deleted and is retired. This repository
does not recreate or deploy it, and main pushes no longer trigger publication.

`Manually publish immutable R2 release` remains a reusable manual procedure for a
separately configured current endpoint. It runs only through `workflow_dispatch`
and fails before validation or release API calls when repository variable
`SKILLAR_RELEASE_BASE_URL` is missing. It never falls back to
`GISUL_RELEASE_BASE_URL`. The immutable builders, verification and rollback tools
remain available; the following serving contracts apply only to an explicitly
configured hosted installation.

## Gates and content preservation

The existing builder and catalog validator remain authoritative. The R2 adapter
preserves their files byte for byte, retains their original inventory as
`build-inventory.json`, and adds the serving inventory. The Worker checks that
inventory, every object's size/digest, the exact object set, release manifests and
SKILL.md frontmatter before marking a release complete.

The migration baseline is content commit
`1ce932b32750d0df3ca74939189dc1d575a3a700`. As of the user's 2026-09-21 policy
change, approved content changes may publish after validation. Model comparisons
and human ratings are optional, not publication requirements. Git ancestry and
latest-main checks remain mandatory. Before upload, every emitted content file is
hashed as a Git blob and compared with the candidate's Git tree, including path
and executable mode. The builder cannot silently transform content.

The optional evaluation guidance in [eval/README.md](../eval/README.md) governs
claims of behavioral improvement. Do not report an evaluation as completed when
it was not run. Candidates under `eval/` remain outside the published catalog.

Authenticated HTTP `create_skill` and `update_skill` commit to canonical main;
they do not modify active R2 objects. `accepted` means saved to Git. Check
`get_skill_write_status` and verify the published manifest before reporting the
change as live. Creation can include supporting files; updates check the loaded
SKILL.md digest and preserve other files.
Saving to main does not publish: hosted activation requires a separate manual
dispatch against the explicitly configured current endpoint.

## Publication and concurrency

An explicit manual dispatch enters the fixed `skillar-r2-production` concurrency
group, with running jobs left intact. The publisher skips changes irrelevant to
the catalog/build. A push to main performs validation without hosted publication.

Before building and immediately before activation, the job fetches main and
requires its candidate to be the current head. A monotonic sequence from this
fixed workflow's `github.run_number` and the current pointer's ETag protect the
final write. Do not replace/reset the publishing workflow's sequence. GitHub queue
order is not a commit-order guarantee.

The immutable key is `releases/<full commit>/`. Its display release ID uses the
commit's date and `3 +` the number of commits since the migration baseline.
Rerunning the same commit therefore produces identical bytes. Inventory uploads
first; each remaining immutable object accepts only identical retries. The job
then calls `/admin/verify`, checks the full catalog and digest-verified SKILL.md
and supporting-file reads over authenticated MCP pinned to the candidate, and
finally calls `/admin/promote`. Verification or upload failure leaves current
unchanged. Fresh MCP reads confirm the activated identity.

A lost activation response triggers a current-pointer readback, never a blind
second mutation. Reconciliation requires the requested identity, operation and
sequence. Every pointer operation advances this sequence, including a rollback
whose target is already current. Jobs retain a receipt after each publication
phase with the before pointer, GitHub run, release/commit, inventory digest and
staged/live MCP evidence as it becomes available. A failed live check may leave
the verified candidate active: its receipt and current readback show that state.
Release/commit also travel with bridge search/load/file events into Langfuse.

## Credentials and target

Set repository variable `SKILLAR_RELEASE_BASE_URL` to the Worker origin, without
`/mcp`. Set repository secrets `SKILLAR_PUBLISH_TOKEN` and `SKILLAR_BEARER_TOKEN`
through GitHub's encrypted Actions secret store. They must match the Worker's
separate publisher and reader credentials. CI does not need Cloudflare account
credentials or public bucket access. Never commit tokens or embed them in URLs.

The former personal origin `https://gisul-mcp.changeroa.workers.dev` and its
`gisul.iyendev.com` domain are retired, not defaults or publication targets.
Historical deployment evidence is retained in the dated records. No current
hosted endpoint is implied by those records. This workflow does not provision or
recreate Cloudflare infrastructure, and configuring a new endpoint requires a
separate deployment decision.

## Recovery and rollback

Rerun a failed job if its commit is still main: identical uploads are safe. If
main has advanced, explicitly dispatch a new run for the current main commit. Inspect `/admin/current`
after an ambiguous activation; the failed request alone does not prove failure.
A failed job may already have activated its candidate. Check the retained receipt's
phase, activation result and failure readback before deciding to roll back.

To reactivate a retained release, dispatch `publish-r2.yml` on main with its full
commit in `rollback_commit`. The job requires it to be an ancestor of the promotion
high-water commit, loads its completed identity, performs pinned MCP reads, then
uses a conditional rollback and fresh current readback. The promotion high-water
mark is retained, preventing an older queued promotion from undoing rollback.
Dispatch the same operation with the newer retained commit to restore it.

Retain completed releases: connections holding old manifests continue to read
their pinned files while fresh searches and loads use current. There is no release
garbage collector in this MVP.

## Installed-plugin and trace verification

After installing the HTTPS plugin and the tested masked exporter through Codex's
plugin CLI, run:

```sh
node scripts/smoke-installed-worker.mjs <content-commit> <runtime-commit> <langfuse-project-id>
```

This selects the actual enabled personal-marketplace plugin cache, compares it
with its source, and calls its three read tools. It searches for
dont-make-me-think, loads its verified manifest and reads SKILL.md plus a supporting
file. It checks exact release/commit, runtime version and manifest digest.

The script feeds metadata from those real calls into an explicitly synthetic
exporter fixture. No model is run, no production user turn is fabricated, and
skill bodies are omitted. It invokes the installed masked hook, verifies every
expected observation and the exact skillar connection join through the Langfuse
API, invokes the hook again and compares observation IDs and multiplicity.
The expected project ID is required; credentials stay in the existing protected
local configuration. Receipts and bridge events are written under ignored
`eval/out/worker-canary/`. These checks are not behavioral evaluations and do not
count toward E14's completed-day production audit.
