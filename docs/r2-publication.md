# GitHub Actions to private R2

Git is the authoring source. `Publish immutable R2 release` validates main, builds
committed bytes, uploads them to the authenticated Worker and changes one R2
pointer after verification. The Worker serves MCP directly from private R2.
Routine publication needs no Mac mini origin, SSH or dashboard uploads.

## Gates and content preservation

The existing builder and catalog validator remain authoritative. The R2 adapter
preserves their files byte for byte, retains their original inventory as
`build-inventory.json`, and adds the serving inventory. The Worker checks that
inventory, every object's size/digest, the exact object set, release manifests and
SKILL.md frontmatter before marking a release complete.

The migration baseline is content commit
`1ce932b32750d0df3ca74939189dc1d575a3a700`, including dont-make-me-think from
`20260917.3`. Publication currently accepts only unchanged published content:
`skills/`, `aliases.json`, `projects/` and `policies/` must match the baseline, or
the last promoted commit after the first release. Git ancestry is also required.
Infrastructure changes can publish automatically; behavioral changes fail closed.
Before upload, a separate check hashes every emitted content file as a Git blob
and compares its object ID, path and executable mode with the candidate's Git
tree. A builder change cannot silently transform otherwise unchanged content.

The real model evaluation/evidence gate in [eval/README.md](../eval/README.md) is
not yet automated. Static tests do not substitute for its critical-case, holdout,
cost, evaluator and genuine human-rating requirements. Connect that evidence gate
before enabling behavioral changes; do not update the baseline to bypass it.
Candidates under `eval/` remain outside the published catalog.

## Publication and concurrency

Every main push enters one fixed `gisul-r2-production` concurrency group, with
running jobs left intact. The publisher itself skips changes irrelevant to the
catalog/build. A workflow path filter would lose relevant changes when a later
documentation commit supersedes a pending run, so there is no path filter.

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

Set repository variable `GISUL_RELEASE_BASE_URL` to the Worker origin, without
`/mcp`. Set repository secrets `GISUL_PUBLISH_TOKEN` and `GISUL_BEARER_TOKEN`
through GitHub's encrypted Actions secret store. They must match the Worker's
separate publisher and reader credentials. CI does not need Cloudflare account
credentials or public bucket access. Never commit tokens or embed them in URLs.

For the initial migration, use the uploaded candidate's preview origin while the
old production version remains active. The old version reads the Mac origin and
has no R2 binding; candidate and future production share the R2 bucket and pointer.
After cutover, a preview is therefore not an isolated publication environment.
Use the runtime commit pinned by `validate.yml` or a tested descendant and verify
that the MCP `serverInfo.version` matches its full source commit. Follow the
[runtime deployment guide](https://github.com/changeroa/gisul/blob/main/docs/deployment.md)
for version upload and activation. After actual installed-plugin and
Langfuse checks, activate that Worker version, verify the production MCP endpoint,
then change the repository variable to the production origin. Keep the R2 bucket
private. Runtime deployment is maintained in `changeroa/gisul`.

## Recovery and rollback

Rerun a failed job if its commit is still main: identical uploads are safe. If
main has advanced, let its newer run publish instead. Inspect `/admin/current`
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
expected observation and the exact gisul connection join through the Langfuse
API, invokes the hook again and compares observation IDs and multiplicity.
The expected project ID is required; credentials stay in the existing protected
local configuration. Receipts and bridge events are written under ignored
`eval/out/worker-canary/`. These checks are not behavioral evaluations and do not
count toward E14's completed-day production audit.
