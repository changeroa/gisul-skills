import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { verifyR2Release } from "./build-r2-release.mjs";

export function releaseApi(base, token, fetcher = fetch) {
  const url = new URL(base);
  assert.ok(url.protocol === "https:" || (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)));
  assert.ok(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/", "Expected a credential-free release origin");
  assert.ok(token, "Missing publication token");
  return async (path, { method = "GET", body, retry = method === "GET" || method === "PUT" } = {}) => {
    assert.ok(path.startsWith("/admin/"));
    for (let attempt = 0; ; attempt++) {
      try {
        const response = await fetcher(new URL(path, url), { method, redirect: "error", headers: { authorization: `Bearer ${token}`, "content-type": body instanceof Uint8Array ? "application/octet-stream" : "application/json" }, body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body), signal: AbortSignal.timeout(120000) });
        let data;
        try { data = await response.json(); }
        catch {
          // Browser challenge/error pages are not API responses. Do not dump
          // their bodies or retry an explicit client rejection as transport loss.
          const error = new Error(`Release API ${method} ${path}: HTTP ${response.status}: expected JSON, received a non-JSON response`);
          error.status = response.status;
          throw error;
        }
        if (response.ok) return data;
        const error = new Error(`Release API ${method} ${path}: HTTP ${response.status}: ${data.error ?? "request failed"}`);
        error.status = response.status;
        throw error;
      } catch (error) {
        if (!retry || attempt >= 2 || (error.status && error.status < 500 && error.status !== 429)) throw error;
        await delay(500 * 2 ** attempt);
      }
    }
  };
}

export function sameRelease(left, right) {
  return !!left && left.commit === right.commit && left.release === right.release && left.inventory_digest === right.inventory_digest;
}

export async function uploadArtifact(api, root, progress = () => {}) {
  const identity = await verifyR2Release(root);
  const bytes = await readFile(join(root, "inventory.json"));
  const manifest = JSON.parse(bytes);
  const prefix = `/admin/releases/${identity.commit}/`;
  await api(prefix + "inventory.json", { method: "PUT", body: bytes });
  let index = 0, completed = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) {
      const file = manifest.files[index++];
      if (!file) return;
      const path = file.path.split("/").map(encodeURIComponent).join("/");
      await api(prefix + path, { method: "PUT", body: await readFile(join(root, file.path)) });
      completed++;
      if (completed % 25 === 0 || completed === manifest.files.length) progress({ uploaded: completed, total: manifest.files.length });
    }
  }));
  return { identity, manifest };
}

export async function activateVerified(api, operation, input) {
  assert.ok(["promote", "rollback"].includes(operation));
  const confirms = current => sameRelease(current, input) && current.sequence === input.sequence && current.operation === operation;
  try {
    await api(`/admin/${operation}`, { method: "POST", body: input, retry: false });
  } catch (error) {
    // A lost response is not permission to repeat a pointer mutation.
    const observed = await api("/admin/current");
    if (!confirms(observed.current)) throw error;
    return { ...observed, reconciled: true };
  }
  const observed = await api("/admin/current");
  assert.ok(confirms(observed.current), "Current readback differs from the verified release or operation sequence");
  return { ...observed, reconciled: false };
}
