import { checkPacks } from "./check-packs-live.mjs";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { digest } from "./release-files.mjs";
import { frontmatter } from "./validate.mjs";

export async function smokeR2(base, token, expected, { pinned = false, manifest } = {}) {
  assert.ok(token, "Missing MCP reader token");
  const client = new Client({ name: "gisul-r2-publication-check", version: "1" });
  const meta = pinned ? { _meta: { "io.gisul/commit": expected.commit } } : {};
  const endpoint = new URL("/mcp", base);
  const transport = new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { authorization: `Bearer ${token}` }, redirect: "error" } });
  try {
    await client.connect(transport);
    const result = await client.request({ method: "skills/list", params: meta }, z.object({ skills: z.array(z.any()), _meta: z.object({ release: z.string(), commit: z.string() }) }));
    assert.equal(result._meta.commit, expected.commit);
    assert.equal(result._meta.release, expected.release);
    if (manifest) assert.deepEqual(result.skills, manifest.skills, "R2 catalog differs from the validated builder artifact");
    const skill = result.skills.find(skill => skill.frontmatter.name === "dont-make-me-think") ?? result.skills.find(skill => skill.resources.some(file => file.uri !== skill.uri && file.uri.endsWith(".md")));
    assert.ok(skill, "Expected a skill with supporting Markdown");
    const loaded = await client.request({ method: "skills/get", params: { uri: skill.uri, ...meta } }, z.object({ skill: z.any(), _meta: z.object({ release: z.string(), commit: z.string() }) }));
    assert.deepEqual(loaded.skill, skill);
    assert.equal(loaded._meta.commit, expected.commit);
    const reads = [];
    async function read(file) {
      const result = await client.readResource({ uri: file.uri, _meta: { "io.gisul/commit": loaded._meta.commit } });
      assert.equal(result.contents.length, 1);
      const content = result.contents[0];
      assert.equal(content.uri, file.uri);
      const bytes = "text" in content ? Buffer.from(content.text, "utf8") : Buffer.from(content.blob, "base64");
      assert.equal(bytes.length, file.size);
      assert.equal(digest(bytes), file.digest);
      reads.push({ uri: file.uri, digest: file.digest, bytes: bytes.length });
      return bytes.toString("utf8");
    }
    const markdown = await read(skill.resources.find(file => file.uri === skill.uri));
    assert.deepEqual(frontmatter(markdown), skill.frontmatter);
    const support = skill.resources.find(file => file.uri !== skill.uri && file.uri.endsWith(".md"));
    assert.ok(support, "No supporting file available for the release smoke check");
    await read(support);
    const packs = manifest?.packs ? await checkPacks(client, expected.commit, manifest, { pinned }) : undefined;
    return { packs, endpoint: endpoint.href, commit: expected.commit, release: expected.release, pinned, skills: result.skills.length, reads };
  } finally { await client.close(); }
}
