# Gisul skills

Private authoring source for workflow skills served by the gisul MCP server.
The code repository is [changeroa/gisul](https://github.com/changeroa/gisul).

`skills/` contains the imported content, with file bytes verified against the
remote server's resource manifests. `migration/import.json` records the source
URIs. `aliases.json` maps adopted `codex` URIs to canonical `gisul` URIs.
Importing content does not change the live server or delete its current roots.

```sh
npm ci
npm run verify
```

Node 24+ is required. `verify` reads the runtime commit from the pinned
`changeroa/gisul` checkout in `.github/workflows/validate.yml`, prepares
`.ci/gisul`, builds the server, typechecks the Worker, installs Chromium,
and runs catalog validation plus the entire test suite. Linux CI also installs
Chromium's system dependencies. The successful receipt is `.ci/verification.json`.
An existing cache with another origin, revision or uncommitted changes is
refused without resetting it; preserve that checkout and use a fresh clone.

`npm run test:unit` and `npm run test:integration` select disjoint parts of the
suite. `npm test` remains the full suite. Its preflight accepts the prepared
cache, the existing sibling `../gisul` layout, or explicit `GISUL_SERVER_PATH`
and `GISUL_WORKER_PATH` overrides. It fails with preparation instructions if
server/bridge builds or Worker dependencies are absent.

The validator independently implements the server's discovery rules: LF YAML
frontmatter with nonempty string `name` and `description`, name matching the final
directory component, at most 512 visible regular files and 16 MiB per skill.
Hidden entries and `node_modules` are ignored; internal symlinks are not followed.
The configured root itself may be a symlink. A symlinked `SKILL.md` is invalid.

Descriptions longer than 1,024 characters, missing Korean/English discovery
keywords, and unresolved Markdown links into `references/`, `scripts/`, or
`assets/` are warnings. They do not silently change imported content or disagree
with the server's eligibility rules. Invalid skills cause a nonzero exit.

The integration test compares valid and skipped skill directories with the real
server, including malformed frontmatter, limits, and symlink cases. For an
independently prepared runtime, set `GISUL_SERVER_PATH` to its compiled
`server/dist/index.js` and `GISUL_WORKER_PATH` to its `worker` directory.

Remote skills remain instructions and supporting data. Import and validation do
not execute scripts contained in a skill.
