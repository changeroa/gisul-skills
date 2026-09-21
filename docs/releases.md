# Content releases

The Mac-based procedure below is retained for rollback history. Current production
uses [GitHub Actions and private R2](r2-publication.md), including authenticated HTTP
creation and updates through canonical Git main.

The authoring source is this private Git repository. Change a Git draft, validate it,
commit it and explicitly promote it. Remote `create_skill` / `update_skill` cannot
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

The publisher verifies before activation, switches `~/gisul/current` atomically,
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
