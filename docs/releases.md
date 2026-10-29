# Content releases

The primary model is a local catalog served by Skillar installed from npm. Follow
the [Skillar setup guide](https://github.com/changeroa/skillar) for local catalog
configuration. Pushing this repository does not publish content to a hosted service.

The former personal Cloudflare deployment is retired. The
[manual R2 publication workflow](r2-publication.md) remains reusable only with an
explicitly configured current endpoint. The Mac-based procedure below is retained
for release and rollback history; it does not recreate the retired deployment.

The authoring source is this private Git repository. Change a Git draft, validate it
and commit it. When using an explicitly configured immutable-release installation,
promote that commit separately. Remote `create_skill` / `update_skill` cannot
edit an immutable published release. Uncommitted edits are never served.

From the canonical checkout:

```sh
npm run validate
npm test
node scripts/build-release.mjs YYYYMMDD.N
sh scripts/release-skills.sh YYYYMMDD.N macmini
```

The builder uses tracked Git bytes from a clean commit. It rejects invalid skills,
symbolic links and unresolved aliases. The package has per-skill manifests and an
inventory covering every published file. Reusing an ID with different bytes fails.

The publisher verifies before activation, switches `~/.skillar/current` atomically,
restarts the HTTP service and checks stdio, bridge and authenticated HTTP. The same
pointer selects skills, aliases and release metadata. Failed verification restores
the previous pointer and service. An interrupted publish leaves its journal and
`.release-lock`; inspect the PID, pointer and journal before repairing it. Do not
delete a live lock or blindly repeat a timed-out write.

```sh
sh scripts/release-skills.sh PREVIOUS_ID macmini --rollback
```

The rollback verifies the previous package and performs the same smoke checks.
Legacy roots remain preserved for recovery but are excluded when `current` exists.
Each activation has a remote journal and a local receipt in `dist/receipts/`.
After success, commit `releases/CHANGELOG.md` and push `release/<id>`; the tag points
to the exact content commit, not the later changelog commit.

Since the 2026-09-21 user decision, model evaluations and human ratings are optional
for skill publication. Validation, manifest parity and release integrity checks remain
required. Evaluation candidates stay outside `skills/` until explicitly promoted.
