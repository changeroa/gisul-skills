import { createServer } from "node:http";
import { once } from "node:events";
import { digest } from "../../scripts/release-files.mjs";

export async function startCanaryServer({ version = "runtime-test-2", corrupt = false, corruptInventory = false } = {}) {
  const token = "private-canary-fixture-token";
  const commit = "a".repeat(40), release = "20261017.1";
  const uri = "skill://gisul/gisul/demo/SKILL.md", support = "skill://gisul/gisul/demo/references/guide.md";
  const markdown = "---\nname: demo\ndescription: Demo\n---\nRead references/guide.md.\n";
  const files = new Map([[uri, markdown], [support, "Supporting fixture bytes.\n"]]);
  const skill = {
    uri, frontmatter: { name: "demo", description: "Demo" },
    resources: [...files].map(([uri, text]) => ({ uri, size: Buffer.byteLength(text), digest: digest(Buffer.from(text)) })),
  };
  const manifest = { schema_version: 1, commit, release, skills: [skill] };
  const inventory = Buffer.from(JSON.stringify(manifest));
  const exchanges = [];
  let mutations = 0;
  const server = createServer(async (request, response) => {
    let text = "";
    for await (const chunk of request) text += chunk;
    const body = text ? JSON.parse(text) : null;
    let sent = "";
    response.once("finish", () => exchanges.push({
      method: request.method, path: request.url, rpcMethod: body?.method ?? null,
      authorized: request.headers.authorization === `Bearer ${token}`,
      status: response.statusCode, headers: response.getHeaders(), body: sent ? JSON.parse(sent) : null,
    }));
    function send(status, value) {
      response.statusCode = status; response.setHeader("content-type", "application/json");
      sent = value === undefined ? "" : JSON.stringify(value); response.end(sent);
    }
    if (request.url === "/inventory.json" && request.method === "GET") {
      return send(200, corruptInventory ? { ...manifest, release: "wrong" } : manifest);
    }
    if (request.url !== "/mcp") {
      if (request.url.startsWith("/admin") && request.method !== "GET") mutations++;
      return send(404, { error: "unknown route" });
    }
    if (request.headers.authorization !== `Bearer ${token}`) return send(401, { error: "unauthorized" });
    if (request.method === "GET") return send(405, { error: "no event stream" });
    if (request.method === "DELETE") return send(200, {});
    if (body?.id === undefined) return send(202);
    let result;
    if (body.method === "initialize") result = { protocolVersion: body.params.protocolVersion, capabilities: { resources: {}, experimental: { skills: {} } }, serverInfo: { name: "canary-fixture", version } };
    else if (body.method === "skills/list") result = { skills: [skill], _meta: { commit, release } };
    else if (body.method === "skills/get") result = { skill, _meta: { commit, release } };
    else if (body.method === "resources/read") {
      const original = files.get(body.params.uri);
      result = { contents: [{ uri: body.params.uri, text: corrupt && body.params.uri === uri ? original.replace("Demo", "Dema") : original }] };
    } else {
      mutations++; return send(200, { jsonrpc: "2.0", id: body.id, error: { code: -32601, message: "method not allowed" } });
    }
    send(200, { jsonrpc: "2.0", id: body.id, result });
  });
  const listening = once(server, "listening");
  server.listen(0, "127.0.0.1"); await listening;
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base, token, manifest, exchanges, get mutations() { return mutations; },
    expected: { commit, release, runtimeVersion: "runtime-test-2", inventoryUrl: base + "/inventory.json", inventoryDigest: digest(inventory) },
    async close() {
      if (!server.listening) return;
      const closed = once(server, "close"); server.close(); server.closeAllConnections(); await closed;
    },
  };
}
