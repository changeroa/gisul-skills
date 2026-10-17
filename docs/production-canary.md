# Read-only production MCP canary

`npm run canary:production -- --out NEW_RECEIPT.json` checks the currently active
MCP service without publishing, staging, activating or rolling back content.
It uses the existing reader-only smoke: initialize, skills/list, skills/get,
resources/read and pack reads. It does not call administrative endpoints.

Configure the existing `GISUL_RELEASE_BASE_URL` and reader `GISUL_BEARER_TOKEN`,
plus `GISUL_CANARY_EXPECTED` as a JSON snapshot:

```json
{
  "commit": "FULL_CONTENT_COMMIT",
  "release": "YYYYMMDD.N",
  "runtimeVersion": "EXPECTED_MCP_SERVER_VERSION",
  "inventoryUrl": "https://YOUR_PUBLIC_SNAPSHOT/inventory.json",
  "inventoryDigest": "sha256:SHA256_OF_EXACT_INVENTORY_BYTES"
}
```

Take `inventory.json` from the retained, verified R2 release artifact and record
its digest independently of the MCP response. The inventory URL must be publicly
readable: its request never receives the MCP bearer. HTTPS is required outside
loopback HTTP fixtures, and credentials/query/fragment URL fields are rejected.
The full inventory is fetched and checked against that configured digest, then
its commit/release, exact skill catalog and actual resource sizes/digests are
checked. Runtime identity is the reported MCP `serverInfo.version`; the canary
does not independently attest a binary that reports the same version.

Receipts record preflight, manifest and MCP phases, with `passed: false` until
every check finishes. Missing configuration, authentication failure, stale
runtime/content, and damaged inventory/resource bytes exit nonzero and retain
the failure phase and code. Raw remote error messages and bearer values are not
retained. Output paths are exclusive: select a new path rather than overwriting
an earlier check.

The scheduled/manual `production-canary.yml` workflow runs daily at 07:23 UTC,
has only `contents: read`, uses the existing reader token and retains its redacted
receipt even on failure. Set `GISUL_CANARY_EXPECTED` as a repository variable
when selecting the expected published release. It contains only the small
identity/URL/digest snapshot, not the full inventory or credentials.

Existing publication callers retain their original smoke behavior. Runtime
checking is required by this canary but remains an explicit optional
`runtimeVersion` argument to `smokeR2`. This workflow performs no deployment.
