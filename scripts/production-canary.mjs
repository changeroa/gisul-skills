import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { digest } from "./release-files.mjs";
import { smokeR2 } from "./r2-smoke.mjs";

const fail = code => { throw Object.assign(new Error(code), { code }); };
const check = (value, code) => { if (!value) fail(code); };
const text = value => typeof value === "string" && value.trim().length > 0;
function publicURL(value) {
  let url;
  try { url = new URL(value); } catch { fail("CANARY_CONFIG_INVALID"); }
  check((url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
    && !url.username && !url.password && !url.search && !url.hash, "CANARY_CONFIG_INVALID");
  return url;
}

export async function runProductionCanary({ base, token, expectedJSON, out }) {
  const path = resolve(out);
  const receipt = { schema: 1, kind: "production-canary", startedAt: new Date().toISOString(), phase: "preflight", passed: false };
  const redact = (_key, value) => typeof value === "string" && text(token) ? value.replaceAll(token, "[REDACTED]") : value;
  const save = () => writeFile(path, JSON.stringify(receipt, redact, 2) + "\n", { mode: 0o600 });
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  try {
    check(text(base) && text(token) && !/[\r\n]/.test(token), "CANARY_CONFIG_INVALID");
    let expected;
    try { expected = JSON.parse(expectedJSON); } catch { fail("CANARY_CONFIG_INVALID"); }
    const keys = ["commit", "release", "runtimeVersion", "inventoryUrl", "inventoryDigest"];
    check(expected && typeof expected === "object" && !Array.isArray(expected)
      && keys.every(key => text(expected[key])) && Object.keys(expected).every(key => keys.includes(key))
      && /^[a-f0-9]{40}$/.test(expected.commit) && /^\d{8}\.\d+$/.test(expected.release)
      && /^sha256:[a-f0-9]{64}$/.test(expected.inventoryDigest), "CANARY_CONFIG_INVALID");
    const endpoint = publicURL(base), inventoryURL = publicURL(expected.inventoryUrl);
    receipt.endpoint = new URL("/mcp", endpoint).href;
    receipt.expected = expected;
    receipt.phase = "manifest"; await save();
    const response = await fetch(inventoryURL, { redirect: "error", signal: AbortSignal.timeout(60000) });
    receipt.inventoryHttpStatus = response.status;
    check(response.ok, "CANARY_MANIFEST_HTTP");
    const bytes = Buffer.from(await response.arrayBuffer());
    check(digest(bytes) === expected.inventoryDigest, "CANARY_MANIFEST_MISMATCH");
    let manifest;
    try { manifest = JSON.parse(bytes); } catch { fail("CANARY_MANIFEST_INVALID"); }
    check(manifest.schema_version === 1 && manifest.commit === expected.commit && manifest.release === expected.release
      && Array.isArray(manifest.skills) && manifest.skills.length > 0, "CANARY_MANIFEST_INVALID");
    receipt.phase = "mcp"; await save();
    receipt.smoke = await smokeR2(endpoint, token, expected, { manifest, runtimeVersion: expected.runtimeVersion });
    receipt.passed = true; receipt.phase = "complete";
  } catch (error) {
    receipt.error = { code: typeof error.code === "number" || typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? error.code : "CANARY_FAILED" };
  }
  receipt.completedAt = new Date().toISOString();
  await save();
  return JSON.parse(JSON.stringify(receipt, redact));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { out: { type: "string", default: "dist/receipts/production-canary.json" } } });
    const receipt = await runProductionCanary({
      base: process.env.GISUL_RELEASE_BASE_URL, token: process.env.GISUL_BEARER_TOKEN,
      expectedJSON: process.env.GISUL_CANARY_EXPECTED, out: values.out,
    });
    console.log(JSON.stringify(receipt, null, 2));
    if (!receipt.passed) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ error: error.code ?? "CANARY_FAILED" })); process.exitCode = 1;
  }
}
