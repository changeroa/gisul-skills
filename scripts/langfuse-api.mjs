import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export async function langfuseApi(configPath = process.env.LANGFUSE_CONFIG ?? join(homedir(), ".codex/langfuse-masked.json")) {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const base = new URL(config.base_url);
  if (base.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(base.hostname)) throw new Error("Langfuse requires HTTPS");
  const auth = `Basic ${Buffer.from(`${config.public_key}:${config.secret_key}`).toString("base64")}`;
  return {
    origin: base.origin,
    async request(path, { method = "GET", body } = {}) {
      if (!path.startsWith("/api/public/")) throw new Error("Only project API paths are supported");
      const response = await fetch(new URL(path, base), { method, headers: { Authorization: auth, ...(body ? { "Content-Type": "application/json" } : {}), ...(path === "/api/public/otel/v1/traces" ? { "x-langfuse-ingestion-version": "4" } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000), redirect: "error" });
      if (!response.ok) {
        const error = new Error(`Langfuse ${method} ${path.split("?")[0]} returned HTTP ${response.status}`);
        error.status = response.status;
        error.retryAfter = response.headers.get("retry-after");
        throw error;
      }
      return response.json();
    }
  };
}
