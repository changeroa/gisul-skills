# Bounded MVP completion

`scripts/mvp-completion.mjs` finishes the already authorized dev-tools MVP
verification after evidence becomes available. It is specific to IYEN-25 (E-03),
IYEN-36 (E-14), and parent IYEN-20. It cannot create issues or modify another
project. It uses the installed Linear connector through a Codex app-server
ephemeral thread without starting a model turn. It sends no comments or messages.

The local manifest and receipts live in ignored `eval/out/mvp-completion-20260917/`.
They contain issue fingerprints, evidence paths, hashes and timing, never connector
credentials or Langfuse prompt/completion bodies. The canonical source is this
repository; the launch agent must execute it from this checkout.

```sh
node scripts/mvp-completion.mjs /absolute/path/manifest.json --preflight
node scripts/mvp-completion.mjs /absolute/path/manifest.json
```

Preflight only reads the three issues, comments, actual Done state and installed
hooks. Review its fingerprints against the intended issue bodies before storing
them in the manifest. The runtime refuses changed requirements or comments.
Current blockers must be completed in the same project immediately before a write.
The target project's milestone, team and parent are checked again on readback.

E-03 requires the retained, hashed idle and isolated-sshd records plus the sleep
observer's actual Sleep/full-Wake record, corroborated against the system power
log, and calls on the old and fresh bridges. Failed calls are valid diagnostic
results. Process pauses, DarkWake alone and observer timeouts cannot pass.
The shared macOS SSH service was not restarted and the original disconnect cause
remains unknown. A person must perform the laptop sleep/wake; this job never does.

E-14 starts no earlier than 2026-09-18 09:10 KST and queries all of September 17
in Asia/Seoul. It uses its own retained checkpoint, respecting Retry-After, and
requires attribution schema 2, a nonempty Codex production population, zero
duplicates/unknown identities/unfinished Codex roots/unattributed producers and
complete pagination. It also verifies the installed exporter bundle and one
trusted Stop hook. The separate overall quality result is retained, not relabeled
as a pass. A failed metric does not cause automatic code or data modification.

Before each mutation the durable receipt records intent. After any response,
including a timeout, the job reads back Linear. An ambiguous write is never
repeated automatically. The parent closes only after querying exactly the
fourteen expected children and confirming all are completed, not canceled.
Existing descriptions retain the first outcome sentence, acceptance, dependencies
and source references; the completed pending-observation section is replaced by
the measured result and a digest marker.

The one-shot launch agent has `KeepAlive=false`, a ten-minute interval, and an
expiry at 2026-09-20 09:10 KST. Before evidence is due it only checks local state.
It removes its plist and unloads itself after all work completes or it expires.
`state.json`, `expired.json` and `schedule-finished.json` record the result.
Offline hosts delay execution; an expired job does not extend its authority.
Stop it early by booting out its exact GUI-domain label and removing its plist.
The independent read-only daily quality schedule continues unchanged.
