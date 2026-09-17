# Worker/R2 deployment, 2026-09-17

The production endpoint is `https://gisul-mcp.changeroa.workers.dev/mcp`. Worker `gisul-mcp` serves the private `gisul-skills-releases` bucket directly in Cloudflare account `8277c1acc712e4a9d00479255015c200` (iyen / iyen.team@gmail.com). Its active bindings have no `ORIGIN_BASE_URL`. The origin deployment at `/Users/iyen/gisul` was preserved and is outside the serving path; R2 public access is disabled.

## Deployed identities

| Item | Verified identity |
| --- | --- |
| Runtime source | `132cadd6ddc27f3f8dde763da8e1b67fec34dc96` |
| Cloudflare version | `49b63e31-0b2d-42eb-8aab-006a7864ebf6` at 100% |
| Cloudflare deployment | `365c9cff-5148-4667-8a10-22bccaa608c7` |
| Current content commit | `e6c7245951993a45cb22e523b5aa49ad450ce172` |
| Current release | `20260917.10` |
| Inventory digest | `sha256:fdc09001f311d8aebe6a554888705a9b166f1d60f5be6ae1ac70cbe8465bb93e` |
| Pointer after restore | revision `4`, operation sequence `5`; promotion high-water sequence `3` at the current content commit |
| Installed gisul | `0.1.0+codex.20260917081254` |
| Installed masked exporter | `0.1.0+codex.20260917083950`, source `809ddcd656180bbfea8c294e7fa18b45cd956b0b` |

These runtime/content identities are distinct from later routing and documentation commits. The routing change in [changeroa/gisul](https://github.com/changeroa/gisul) is on main at `9959728c1726f50c5e7dd4890116d3091bd0a6b1`; it did not change the active runtime code.

## Publication and recovery evidence

| Actions run | Verified outcome |
| --- | --- |
| [35196744614](https://github.com/changeroa/gisul-skills/actions/runs/35196744614) | First immutable release `20260917.6`, content `6dccec5d232a1a935dbfb12bab2ff2fcccc5087d`; pointer revision/sequence `1/1`. |
| [35198044520](https://github.com/changeroa/gisul-skills/actions/runs/35198044520) | Custom-domain browser challenge before `/admin/current`; existing release and pointer remained unchanged. |
| [35198688180](https://github.com/changeroa/gisul-skills/actions/runs/35198688180) | Automatic main publication of `20260917.10` through the stable endpoint; pointer revision/sequence `2/3`. |
| [35199495599](https://github.com/changeroa/gisul-skills/actions/runs/35199495599) | Actual rollback to retained `20260917.6`; pointer revision/sequence `3/4`, promotion high-water preserved. |
| [35200085460](https://github.com/changeroa/gisul-skills/actions/runs/35200085460) | Restored retained `20260917.10`; pointer revision/sequence `4/5`, promotion high-water preserved. |

Each successful publication or rollback retained a `r2-publication.json` Actions artifact with staged and fresh MCP readback. The final restore became active at `2026-09-17T08:33:35.411Z`. Independent authenticated current-pointer readback confirmed its commit, digest, sequence and high-water mark.

Actions compared all 252 content files with their Git objects and verified all 254 inventoried R2 files before promotion. Independent R2 inventory downloads matched both release receipts. The catalog contains 33 skills, including unchanged dont-make-me-think content from accepted release `20260917.3`.

The custom domain `gisul.iyendev.com` still points to this Worker, but its zone challenged an unattended GitHub runner. Both Actions and installed clients use the stable workers.dev endpoint. Reader/publisher bearer separation and private R2 remain enforced; unrelated zone security settings were not changed.

## Installed client and trace evidence

A fresh native Codex app-server loaded the installed `gisul@personal` plugin and successfully called `search_skills`, `load_skill` and `read_skill_file` against current release `20260917.10`. It read the 3,763-byte dont-make-me-think supporting file with a verified manifest digest and the expected runtime commit. The local plugin contains one 3,020-byte loader, with skill bodies read remotely on demand.

Across the live `.6` to `.10` publication, an already-loaded connection continued to read its `.6` supporting file after its next search saw `.10`; a fresh connection loaded `.10`. The first fresh-client probe used a cache directory removed during endpoint reinstall. Its successful old-file event was retained, and the fresh-client check was rerun against the actual current installed cache. This recovery is explicit in the local proof.

The installed-plugin [synthetic Langfuse canary](https://jp.cloud.langfuse.com/project/cmu275pqc00i8ad0d79dddjgk/traces/62b069e2ec84da2ab7219c258d478f26) verifies exact release, commit, manifest digest and connection join. All six expected observations retained their IDs and multiplicity after a repeated hook. The first `.10` canary exposed a local masking bug that normalized the release string to `.1`; the deployed exporter fix preserves scalar-looking strings, including large integer IDs, while retaining credential masking. Both new regression tests failed before the fix and passed after it.

A fresh Codex hook listing confirms exactly one enabled, trusted Stop hook, provided by the installed masked exporter. Local/CI checks passed: Worker 35 tests, server 39, skills 23 and exporter 77, plus relevant TypeScript and LSP checks. Local Worker tests cover tampering, incomplete uploads, stale/racing pointer writes and pinning with different file contents. Live checks establish actual publication, rollback/restore, authentication, installed-client reads and trace readback. The canary is an explicit synthetic integration fixture; it is neither a model-selection evaluation nor E14's production-day audit.

## Continuing source and operations

Permanent GitHub checkouts are `/Users/iyen/dev-tools/gisul`, `/Users/iyen/dev-tools/gisul-skills` and `/Users/iyen/dev-tools/langfuse-masked`. Continue on their main branches. This record and its [publisher/rollback runbook](r2-publication.md) are maintained in `changeroa/gisul-skills/docs/`. Documentation-only main changes skip publication when there are no relevant changes since the last promotion.

GitHub uses task-only `GH_CONFIG_DIR=/Users/iyen/.config/gh-gisul-dev-tools`, with `GH_TOKEN`/`GITHUB_TOKEN` unset and the same environment in repository-local Git credential helpers. Global GitHub authentication was preserved. The reader token remains outside plugin source/cache at `/Users/iyen/.config/gisul-worker-dev-tools/mcp-bearer`, mode 0600. Cloudflare account OAuth and the separate publisher credential are independent credentials.

Mac evidence is retained under `/Users/iyen/dev-tools/session-notes/`: `live-restored-current.json`, `live-pinning-proof.json`, `native-installed-mcp-proof.json`, `installed-hooks-proof.json`, downloaded publication artifacts, binding/auth proofs and test logs. The final canary receipt is under `eval/out/worker-canary/synthetic-worker-canary-d6ed5fd3-58ba-4c5c-a7b9-e790efba2012/` in the skills checkout. These local files supplement the linked service and Actions evidence.

Work used Herdr w3:p5 with `HERDR_ENV=1` and its own event monitor, whose PID and events are recorded in `session-notes/herdr-w3p5-monitor.pid` and `session-notes/herdr-w3p5-events.jsonl` under `/Users/iyen/dev-tools`. Existing w3:p2 was not operated. No temporary worktree or competing E14 completion writer was created; prior installed-plugin source backups were retained.

## Remaining gates

Behavioral skill changes remain blocked until the real model, critical-case, holdout, cost and genuine human-rating evidence gate in [eval/README.md](../eval/README.md) is connected. Unchanged-content migration and infrastructure publication are enabled; static tests do not approve behavioral changes.

E03/IYEN-25 now has live Worker evidence, but this Mac's Linear connector is unavailable, so its completion has not been written. Update only the dev-tools project through the Linear API/plugin after connection and a fresh issue read. E14/IYEN-36 remains owned by the laptop job `com.iyendev.dev-tools-mvp-completion-20260917` after **2026-09-18 09:10 KST**; see its [completion runbook](mvp-completion.md). Leave the MVP parent open until the actual completed-day gate passes; synthetic canaries do not satisfy it.
