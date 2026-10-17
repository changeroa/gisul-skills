import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { publicationFixture } from "./fixtures/publish-preflight.mjs";

for (const [name, changes] of [
  ["missing Actions context", { GITHUB_ACTIONS: undefined }],
  ["wrong repository", { GITHUB_REPOSITORY: "untrusted/repository" }],
  ["wrong ref", { GITHUB_REF: "refs/heads/topic" }],
  ["wrong commit", { GITHUB_SHA: "a".repeat(40) }],
  ["missing run number", { GITHUB_RUN_NUMBER: undefined }],
  ["invalid run number", { GITHUB_RUN_NUMBER: "1.5" }],
  ["missing reader token", { GISUL_BEARER_TOKEN: undefined }],
  ["missing publisher token", { GISUL_PUBLISH_TOKEN: undefined }],
  ["missing release URL", { GISUL_RELEASE_BASE_URL: undefined }],
  ["invalid release URL", { GISUL_RELEASE_BASE_URL: "invalid-fixture-publisher-secret" }],
  ["credential-bearing URL", { GISUL_RELEASE_BASE_URL: "https://fixture-reader-secret:fixture-publisher-secret@publication.example.invalid" }],
  ["non-local HTTP URL", { GISUL_RELEASE_BASE_URL: "http://publication.example.invalid" }],
]) {
  test(`publication retains a redacted preflight failure for ${name}`, async t => {
    const fixture = await publicationFixture(t);
    const result = await fixture.run(changes);
    assert.equal(result.code, 1);
    assert.equal(result.receipt.state, "failed");
    assert.equal(result.receipt.phase, "preflight");
    assert.equal(typeof result.receipt.error.message, "string");
    assert.ok(result.receipt.error.message.length > 0);
    assert.equal(result.receipt.error.status, null);
    for (const secret of [fixture.env.GITHUB_TOKEN, fixture.env.GISUL_BEARER_TOKEN, fixture.env.GISUL_PUBLISH_TOKEN]) {
      assert.ok(!JSON.stringify(result).includes(secret), "receipts and CLI output must not disclose credentials");
    }
  });
}

test("publication redacts credentials echoed by an initial release API failure", async t => {
  const fixture = await publicationFixture(t);
  const requests = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, path: request.url, authorization: request.headers.authorization });
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: Object.values(fixture.env).join(" ") }));
  });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1");
  await listening;
  const result = await fixture.run({ GISUL_RELEASE_BASE_URL: `http://127.0.0.1:${server.address().port}` });
  assert.equal(result.code, 1);
  assert.equal(result.receipt.state, "failed");
  assert.equal(result.receipt.phase, "checking-main");
  assert.equal(result.receipt.error.status, 401);
  assert.deepEqual(requests, [{
    method: "GET", path: "/admin/current", authorization: `Bearer ${fixture.env.GISUL_PUBLISH_TOKEN}`,
  }], "an initial read failure must not upload, verify, or activate");
  assert.equal(result.receipt.workflow_commit, fixture.env.GITHUB_SHA);
  assert.equal(result.receipt.sequence, 7);
  for (const secret of [fixture.env.GITHUB_TOKEN, fixture.env.GISUL_BEARER_TOKEN, fixture.env.GISUL_PUBLISH_TOKEN]) {
    assert.ok(!JSON.stringify(result).includes(secret), "server-echoed secrets must not reach receipts or stderr");
  }
});
