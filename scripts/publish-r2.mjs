import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildR2Release } from "./build-r2-release.mjs";
import {
  CONTENT_PATHS,
  MIGRATION_BASELINE,
  git,
  requireGitContentParity,
  requireLatestMain,
  requirePublicationGate,
} from "./publication-gate.mjs";
import {
  activateVerified,
  releaseApi,
  uploadArtifact,
} from "./r2-publisher.mjs";
import { smokeR2 } from "./r2-smoke.mjs";

const repo = fileURLToPath(new URL("..", import.meta.url));
assert.equal(
  process.env.GITHUB_ACTIONS,
  "true",
  "Production publication runs only in GitHub Actions",
);
assert.equal(process.env.GITHUB_REPOSITORY, "changeroa/gisul-skills");
assert.equal(
  process.env.GITHUB_REF,
  "refs/heads/main",
  "Only main can publish or roll back",
);
const commit = git(repo, ["rev-parse", "HEAD"]);
assert.equal(commit, process.env.GITHUB_SHA);
const sequence = Number(process.env.GITHUB_RUN_NUMBER);
assert.ok(Number.isSafeInteger(sequence) && sequence > 0);
assert.ok(process.env.GISUL_BEARER_TOKEN, "Missing MCP reader token");
const base = process.env.GISUL_RELEASE_BASE_URL;
const api = releaseApi(base, process.env.GISUL_PUBLISH_TOKEN);
const receipt = {
  state: "running",
  phase: "checking-main",
  workflow_run: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  sequence,
  workflow_commit: commit,
};
async function persist() {
  await mkdir(join(repo, "dist/receipts"), { recursive: true });
  await writeFile(
    join(repo, "dist/receipts/r2-publication.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
}
try {
  requireLatestMain(repo, commit);
  const before = await api("/admin/current");
  receipt.before = before;
  const rollback = process.env.GISUL_ROLLBACK_COMMIT;
  let identity, gate, staged;
  const operation = rollback ? "rollback" : "promote";
  receipt.operation = operation;
  receipt.phase = "preparing";
  await persist();
  if (rollback) {
    assert.equal(process.env.GITHUB_EVENT_NAME, "workflow_dispatch");
    assert.match(rollback, /^[a-f0-9]{40}$/);
    assert.ok(before.current, "No current release to roll back");
    git(repo, [
      "merge-base",
      "--is-ancestor",
      rollback,
      before.current.high_water.commit,
    ]);
    identity = await api(`/admin/releases/${rollback}`);
    staged = await smokeR2(base, process.env.GISUL_BEARER_TOKEN, identity, {
      pinned: true,
    });
  } else {
    if (
      before.current &&
      !git(repo, [
        "diff",
        "--name-only",
        before.current.high_water.commit,
        commit,
        "--",
        ...CONTENT_PATHS,
        "scripts",
        "package.json",
        "package-lock.json",
        ".github/workflows",
      ])
    ) {
      Object.assign(receipt, {
        state: "unchanged",
        reason: "No relevant changes since the last publication",
        current: before.current,
      });
      await persist();
      console.log(JSON.stringify(receipt));
      process.exit(0);
    }
    gate = requirePublicationGate(
      repo,
      commit,
      before.current?.high_water.commit,
    );
    const date = git(repo, ["show", "-s", "--format=%cs", "HEAD"]).replaceAll(
      "-",
      "",
    );
    // A new workflow run for the same commit must reuse identical upload bytes.
    const revision =
      Number(
        git(repo, ["rev-list", "--count", `${MIGRATION_BASELINE}..${commit}`]),
      ) + 3;
    const output = await buildR2Release(repo, `${date}.${revision}`);
    receipt.git_parity = await requireGitContentParity(repo, commit, output);
    receipt.phase = "uploading";
    receipt.gate = gate;
    await persist();
    const artifact = await uploadArtifact(api, output, (progress) =>
      console.log(JSON.stringify(progress)),
    );
    identity = artifact.identity;
    receipt.candidate = identity;
    receipt.phase = "verifying";
    await persist();
    await api("/admin/verify", {
      method: "POST",
      body: { ...identity, expected_etag: before.etag, sequence },
      retry: true,
    });
    staged = await smokeR2(base, process.env.GISUL_BEARER_TOKEN, identity, {
      pinned: true,
      manifest: artifact.manifest,
    });
  }
  Object.assign(receipt, {
    candidate: identity,
    staged,
    phase: "ready-to-activate",
  });
  await persist();
  requireLatestMain(repo, commit);
  receipt.phase = "activating";
  await persist();
  const result = await activateVerified(api, operation, {
    ...identity,
    expected_etag: before.etag,
    sequence,
  });
  Object.assign(receipt, result, { phase: "activated" });
  await persist();
  const live = await smokeR2(base, process.env.GISUL_BEARER_TOKEN, identity);
  Object.assign(receipt, { state: "published", phase: "complete", live });
  await persist();
  console.log(JSON.stringify(receipt, null, 2));
} catch (error) {
  if (receipt.phase === "activating" || receipt.phase === "activated") {
    try {
      receipt.failure_readback = await api("/admin/current");
    } catch {
      receipt.failure_readback = "unavailable";
    }
  }
  Object.assign(receipt, {
    state: "failed",
    error: { message: error.message, status: error.status ?? null },
  });
  await persist();
  throw error;
}
