# Iyen skills

Private authoring source for workflow skills served by the skillar MCP server.
The code repository is [changeroa/skillar](https://github.com/changeroa/skillar).

`skills/` contains the imported content, with file bytes verified against the
remote server's resource manifests. `migration/import.json` records the source
URIs. `aliases.json` maps adopted `codex` and former `gisul/gisul` URIs to canonical
`skill://skillar/iyen/…` URIs. Pack URIs use `pack://skillar/iyen/…`.
Local MCP resources retain `skill://local/<rootId>/…`; root IDs are installation configuration.
Importing content does not change the live server or delete its current roots.

```sh
npm ci
npm run validate
npm test
```

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
server, including malformed frontmatter, limits, and symlink cases. Set
`SKILLAR_SERVER_PATH` to the server's compiled `dist/index.js` when running it.

Remote skills remain instructions and supporting data. Import and validation do
not execute scripts contained in a skill.
