# Mac mini: Worker + R2 continuation

## User direction, 2026-09-17

Continue implementation on Mac mini (`ssh macmini`) in a **new Herdr pane and a fresh Codex session**. Do not resume or prompt the older dev-tools Codex session. Fetch implementation from GitHub. Request any needed Cloudflare authentication **in the new Mac mini Herdr session**, where the user will respond. The user authorized continuing the MVP, implementing Worker direct serving, and automatic R2 publication after Git updates. Do not ask again whether to use the proxy or direct hosting.

The selected architecture is:

`private Git authoring SSOT -> validated immutable release -> private R2 -> authenticated Worker MCP -> lazy skill reads`

The user-facing workflow is: change a skill, merge into the publishing branch, and let CI validate and publish. Do not make routine edits require manual dashboard uploads. Fresh Codex starts with the small gisul loader and loads only relevant skills/supporting files.

## Source and branches

Use these permanent working directories on Mac mini. The older `/Users/iyen/gisul` is a live deployment, not the development checkout.

| Repository | Branch | Starting implementation commit | Mac mini checkout |
| --- | --- | --- | --- |
| changeroa/gisul | feat/dev-tools-mvp | 10ea0c0ed8942d5ac00f394fc39b8a8711f3dfd2 | /Users/iyen/dev-tools/gisul |
| changeroa/gisul-skills (private) | feat/releases-and-feedback | 074b95f2fb66937dbfacc6c9db02ee80c74583ec | /Users/iyen/dev-tools/gisul-skills |
| changeroa/langfuse-masked (private) | feat/idempotent-context-traces | 171fcdfdb6c7707ab2d16d81ec4ea6136aaaab47 | /Users/iyen/dev-tools/langfuse-masked |

This handoff and the design snapshot are versioned on `gisul-skills` branch `handoff/worker-r2-20260917`, under `docs/handoffs/worker-r2-20260917/`. They are outside the published skill roots. Continue implementation on the listed feature branches and update their existing draft PRs: gisul PR 2, gisul-skills PR 1, langfuse-masked PR 1. Requery branch heads before pushing; another session recently added the unchanged dont-make-me-think skill. Never force-push or overwrite concurrent changes.

Read repository AGENTS.md. The old gisul AGENTS rule requiring token validation at a Mac mini origin describes the proxy architecture: the user's explicit direct-hosting choice supersedes that architectural constraint. Update the documentation along with the new implementation; it does not require another confirmation.

## Already implemented and verified

- gisul Node server and bridge support immutable skill releases, manifests/digests, aliases, lazy reads, and release/connection event identity.
- `server/src/codex.ts`: HTTPS upstream via `--http-url` and external `--bearer-token-file`; HTTP is allowed only for loopback runtime tests. Reject embedded URL credentials/query/fragment, ambiguous connection arguments and redirects. HTTP exposes only search/load/read tools, not create/update.
- `clients/codex/install-plugin.mjs`: installer supports HTTPS as well as existing SSH; preserves cachebuster/install verification and smoke workflow. Tokens are external files, not plugin contents.
- `server/test/http-bridge.test.mjs`: actual Worker proxy fetch handler + real local HTTP origin + real bridge exercised authentication, search/load/support file verification, release identity and restart recovery. Last server suite: 37 passing; server build, Worker typecheck, changed-file LSP and installer dry-run passed. These tests do not establish live Worker deployment.
- `gisul-skills/scripts/build-release.mjs`, `release-files.mjs` already build from committed tracked Git bytes, validate canonical skill URIs/manifests/inventory, reject symlinks and conflicting release IDs. Existing publisher targets Mac mini; reuse the builder and add an R2 publishing path.
- Most recent skill changelog is release **20260917.3**, content commit **1ce932b32750d0df3ca74939189dc1d575a3a700**. It imports dont-make-me-think unchanged and reports 16 tests + release smoke/readback passed. Older snapshots below still say 20260917.2; requery live state and do not revert the added skill.
- `langfuse-masked` deployed exporter is 171fcdf. It has idempotent trace handling and release/context evidence. Actual automated work is production; exclude only explicit synthetic configuration/tags. Never label all automated work synthetic.

## Work to implement

1. **Worker direct serving.** Replace the dependency on ORIGIN_BASE_URL/Mac mini for skill reads with an R2 binding. Preserve protocol extension compatibility (`skills/list`, `skills/get`, resources reads), current bridge tools, stable skill URIs, manifest verification, release identity, and lazy file access. New connections use the active release; a loaded skill's support files remain readable from its pinned immutable version. Do not claim version pinning based on mutable current paths alone.
2. **Authentication.** Authenticate at the actual serving boundary. Keep R2 private; do not place bearer tokens, Cloudflare credentials or private skill contents in the public gisul repository. Preserve a usable client setup without needing local SSH. Cloudflare account login and MCP client bearer authentication are separate concerns.
3. **GitHub -> R2 pipeline.** Prefer push to `main` for relevant skill/catalog/build changes, with validation/evaluation gates before activation. Keep PR/branch checks separate from publication. Skills/bootstrap behavior changes must respect the existing evaluation gate; structural migration of unchanged bytes uses manifest parity/integration checks. Candidates outside `skills/` are not production skills.
4. **Immutable and recoverable publish.** Upload a versioned release under a deterministic identity (commit SHA is suitable); verify all uploaded bytes/inventory, then update one current-release pointer. Incomplete upload leaves the old version active. Serialize promotions and reject a superseded workflow activating older content; concurrency alone does not guarantee commit order. Protect pointer changes against races, use idempotent retries, read back ambiguous writes before retrying, and provide rollback to an already verified release. Do not treat multi-object R2 uploads as a transaction. Keep the mutable pointer out of stale caches.
5. **Observability and tests.** Preserve release/commit/digest in skill read events and Langfuse evidence. Test auth failure, tampering/path guards, incomplete publication, old/new release pinning, rollback and overlapping publication where meaningful. Run existing required checks. Use actual live Worker search/load/read and plugin smoke tests after deployment; report those separately from local tests.
6. **Deploy and document.** Prepare the reviewable implementation first. On Mac mini, query the intended Cloudflare identity/target, and ask the user in this fresh Herdr pane for login/account selection when needed. Inspect `wrangler ... --help` rather than guessing syntax. OAuth/device/browser completion belongs to the user. Do not request raw tokens in chat or dump credentials. Verify the authenticated target before creating resources. Configure CI's scoped R2 publication credentials through the appropriate secret store. Record the real Worker URL, deployed commit and canonical directories after deployment.

A locally inherited Cloudflare API token previously failed with error 9109. The laptop's stored OAuth login was for dev@arkpoint.kr and did not contain gisul-mcp. This is not proof of the correct Mac mini account. A guessed workers.dev URL returned 403 and is not a verified deployment target. No new Worker/R2 resource has been created for this migration, and no HTTPS production cutover has occurred.

## MVP / Linear completion constraints

Only write the **dev-tools** project in IYEN, using the installed Linear API/plugin (not browser automation). No Slack notifications or other project writes.

- Project: b86d7139-c2bd-4075-b720-20d5f20dcc81; team IYEN Development be395db1-8ee7-4c30-9fe8-f7a2ba8404c5.
- MVP parent IYEN-20; 14 children IYEN-23 through IYEN-36. Latest recorded completion was 12/14. Requery before any update.
- E-03 / IYEN-25 (a1d2ce3f-664d-42a5-82dd-971e7132e51e) is now `[E-03] Worker HTTPS 연결 검증`, in progress. Local HTTP test AC is checked; actual account/endpoint/plugin/live evidence AC remains unchecked. The old actual-sleep criterion is superseded. Depends on IYEN-24 and blocks IYEN-46. Do not close from local-only tests.
- E-14 / IYEN-36 (1c89b823-8bfa-45fc-8591-494d3ae817e8), `[E-14] 중복 tracing 훅 정리`, remains verifying. Legacy hook removal is complete; an actual complete calendar day with zero Codex duplicates is still required. Partial Sep 17 evidence is not a completed-day result. Earliest scheduled Sep 17 audit: **2026-09-18 09:10 KST**.
- The laptop has a bounded launchd completion job `com.iyendev.dev-tools-mvp-completion-20260917`, expires Sep 20 09:10 KST, plus read-only daily quality collection. Source lives in gisul-skills scripts/mvp-completion.mjs and docs/mvp-completion.md; runtime journal/config is ignored at `/Users/victor/dev-tools/gisul-skills/eval/out/mvp-completion-20260917/`. It currently can handle E-14 only: E-03 and parent fingerprints changed and must not be closed by obsolete SSH evidence. Do not start a competing writer or claim full MVP automatic closure without reconciling those guards.
- The SSH sleep observer was stopped and its plist removed. Do not restart it or perform new sleep/SSH service interruption tests for this direction.
- Requery on a Linear write timeout before retrying. Keep descriptions concise with user-visible outcome, acceptance checklist and real dependency links. Update only with actual evidence; preserve relationships/project/milestone.

## Working conventions

- The new pane was created on Mac mini in Herdr session `default`, workspace `w3`, tab `w3:t1`, pane **w3:p4**, cwd `/Users/iyen/dev-tools`. Existing pane w3:p2 must remain untouched.
- Start a fresh Codex session, not resume/fork. The user will interact with Cloudflare authentication in this new pane. Keep the user informed in Korean.
- Keep an event monitor for agent/pane/tab changes. Parent handoff monitor is currently subscribed, but establish your own monitor for ongoing work. Read and follow the local Herdr skill and current CLI help; verify HERDR_ENV=1. Do not stop/update other sessions or operate unrelated panes.
- Use rg for literal search, ast-grep for structural code changes, activate LSP for type/symbol operations (install/configure missing servers as needed). Use codegraph if an index exists and verify its freshness. Browser QA/automation requires the aside-browser skill.
- Do not create additional agents unless the user or applicable instructions ask for delegation. Ordinary tests/build processes can run in your own pane or owned shells.
- Own temporary worktree cleanup; preserve all changes first and inspect git worktree list before final reporting. Permanent /Users/iyen/dev-tools checkouts are the continuing source, not disposable worktrees.
- Implement until the authorized outcome is complete, or an actual authentication/user-input dependency blocks it. Ask for Cloudflare login in this pane while continuing independent implementation where possible. Clearly distinguish implemented, tested and deployed.

## Reference snapshot

`PRD.md` and `design/*.md` next to this file are the original planning snapshot. Read relevant design files as needed. They contain older Mac mini hosting assumptions; the explicit Worker+R2 direction above supersedes those choices. `prior-implementation/` holds the laptop's prior status snapshots for evidence, not current hosting decisions.

Official references: [R2 uploads](https://developers.cloudflare.com/r2/objects/upload-objects/), [R2 consistency and caching](https://developers.cloudflare.com/r2/reference/consistency/), [GitHub push workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push), [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [Cloudflare MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/). Check current primary docs when implementing provider-specific behavior.
