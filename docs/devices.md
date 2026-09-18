# Compare installed devices

On each device, install this checkout's dependencies with `npm ci`, then run:

```sh
scripts/check-device.sh --device macmini --out eval/out/devices/macmini.json
```

Use `macbook-pro` or `macbook-air` for those devices. The command reads the global
`AGENTS.md`, selected personal plugin versions, and the installed HTTPS plugin's
actual release and digest-verified file. It does not install plugins or copy
credentials. An empty global instruction file is valid and has its own digest.

Bring the three JSON snapshots together, then compare:

```sh
scripts/check-device.sh --compare eval/out/devices/macbook-pro.json eval/out/devices/macmini.json eval/out/devices/macbook-air.json
```

Exit 0 means all three fresh snapshots agree; 2 means missing, stale, incomplete
or different state; 1 means the command or input could not be read. Snapshots must
be no more than 24 hours old. Duplicate device names cannot satisfy the
three-device check; collect each snapshot on the named host. CLI versions are recorded for diagnosis; instruction hashes,
both plugin versions, endpoint, release, commit and selected manifest must agree.

This verifies installation state, not the behavior or quality of new instructions.
IYEN-45 stays open until its prerequisite evaluation, the Air installation and
actual three-device agreement have been verified.
