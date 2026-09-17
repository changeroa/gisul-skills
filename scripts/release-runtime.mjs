import { execFileSync } from "node:child_process";
import { chmod, lstat, mkdir, readFile, readlink, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { inventory, releaseId, verifyRelease } from "./release-files.mjs";

async function pointer(root) {
  try { return await readlink(join(root, "current")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
async function switchTo(root, target) {
  if (target === null) { await rm(join(root, "current")); return; }
  const temporary = join(root, `.current-${process.pid}-${Date.now()}`);
  try { await symlink(target, temporary); await rename(temporary, join(root, "current")); }
  finally { await rm(temporary, { force: true }); }
}
export async function activateRelease({ root, id, staging, smoke, restart = async () => {} }) {
  releaseId(id);
  root = resolve(root);
  await mkdir(join(root, "releases"), { recursive: true });
  const lock = join(root, ".release-lock");
  await mkdir(lock);
  const journal = { release: id, started_at: new Date().toISOString(), pid: process.pid, state: "preparing", previous: null };
  const journalPath = join(root, "releases", `.activation-${id}-${Date.now()}.json`);
  const save = async () => {
    await writeFile(`${journalPath}.tmp`, JSON.stringify(journal, null, 2) + "\n", { mode: 0o600 });
    await rename(`${journalPath}.tmp`, journalPath);
  };
  let switched = false;
  let retainLock = false;
  try {
    journal.previous = await pointer(root);
    if (journal.previous !== null && !/^releases\/\d{8}\.[1-9]\d*$/.test(journal.previous)) throw new Error("Unexpected current pointer; inspect before changing it");
    const target = join(root, "releases", id);
    if (staging) {
      const candidate = await verifyRelease(staging);
      if (candidate.release !== id) throw new Error("Staged release ID mismatch");
      try {
        await lstat(target);
        if ((await verifyRelease(target)).inventory_digest !== candidate.inventory_digest) throw new Error("Immutable release already exists with different bytes");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await rename(staging, target);
      }
    }
    const record = await verifyRelease(target);
    if (record.release !== id) throw new Error("Target release ID mismatch");
    journal.commit = record.commit; journal.inventory_digest = record.inventory_digest;
    await smoke(target, id, false);
    for (const file of await inventory(target)) await chmod(join(target, file.path), file.executable ? 0o555 : 0o444);
    await chmod(join(target, "inventory.json"), 0o444);
    if (journal.previous === `releases/${id}`) {
      await smoke(join(root, "current"), id, true);
      journal.state = "unchanged"; await save(); return journal;
    }
    journal.state = "switching"; await save();
    await switchTo(root, `releases/${id}`); switched = true;
    await restart();
    await smoke(join(root, "current"), id, true);
    journal.state = "active"; await save();
    return journal;
  } catch (error) {
    journal.error = error.message;
    if (switched) {
      try {
        await switchTo(root, journal.previous);
        await restart();
        if (journal.previous) {
          const previous = await verifyRelease(join(root, journal.previous));
          await smoke(join(root, "current"), previous.release, true);
        }
        journal.state = "rolled_back";
      } catch (recovery) {
        journal.state = "recovery_failed";
        journal.recovery_error = recovery.message;
        retainLock = true;
      }
    } else journal.state = "rejected";
    await save();
    throw error;
  } finally { if (!retainLock) await rm(lock, { recursive: true }); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [root, id, staging] = process.argv.slice(2);
  if (!root || !id) throw new Error("Usage: release-runtime.mjs <root> <release-id> [staging]");
  const { smokeServer } = await import(pathToFileURL(join(root, "server/smoke-server.mjs")));
  const restart = async () => {
    const label = `gui/${process.getuid()}/com.iyendev.gisul-mcp`;
    try { execFileSync("launchctl", ["kickstart", "-k", label], { timeout: 15000, stdio: "pipe" }); }
    catch (error) {
      if (error.code !== "ETIMEDOUT") throw error;
      execFileSync("launchctl", ["bootout", label], { timeout: 15000, stdio: "pipe" });
      execFileSync("launchctl", ["bootstrap", `gui/${process.getuid()}`, join(process.env.HOME, "Library/LaunchAgents/com.iyendev.gisul-mcp.plist")], { timeout: 15000, stdio: "pipe" });
    }
  };
  const smoke = async (content, expected, live) => {
    const tokenFile = join(process.env.HOME, ".config/secrets/gisul-mcp-bearer-token");
    const env = { ...process.env, GISUL_ROOT: root, GISUL_SKILL_ROOTS: `gisul=${join(content, "skills")}`, GISUL_RELEASE_FILE: join(content, "release.json"), GISUL_ALIASES_FILE: join(content, "aliases.json"), GISUL_BEARER_TOKEN_FILE: tokenFile };
    const result = await smokeServer({ root: join(root, "server"), env, ...(live ? { httpUrl: "http://127.0.0.1:8788/mcp" } : {}) });
    if (result.release !== expected) throw new Error("Smoke returned a different release");
  };
  console.log(JSON.stringify(await activateRelease({ root, id, staging, smoke, restart })));
}
