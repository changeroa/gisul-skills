<p align="center"><a href="README.md">English</a> · <a href="README.ko.md">한국어</a></p>

<p align="center">
  <img src="docs/assets/gisul-workshop.png" alt="The gisul workshop: instruction cards, measuring tools, and a verification bench" width="100%">
</p>
<h1 align="center">gisul-skills</h1>
<p align="center"><strong>“Just do it well” isn't a procedure.</strong><br>Less hand-waving. More procedure.</p>
<p align="center">
  <a href="#pick-a-problem">Pick a skill</a> ·
  <a href="#use-it">Use it</a> ·
  <a href="#contribute-a-skill">Contribute</a> ·
  <a href="https://github.com/changeroa/gisul">Connect with gisul</a>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/format-SKILL.md-242424?style=flat-square" alt="SKILL.md format">
  <img src="https://img.shields.io/badge/delivery-gisul_MCP-c6492d?style=flat-square" alt="Delivered by gisul MCP">
</p>

---

## “Act like an expert.” And do what, exactly?

People say they've uploaded tacit knowledge. Encoded expertise. Transferred know-how.

**Nice pitch. Now show me what the agent actually does.**

A screen that can't tell “no data” from “the request failed.”<br>
Ten alleged bugs that fall apart when you follow the code.<br>
Green tests. Missing data the moment you reopen the page.

These skills spell out **what to read → what to check → what evidence to leave behind** when those problems show up.

This is not expertise in a bottle. It's a set of procedures an agent can try to follow. Less interest in impressive role descriptions. More interest in **actions it must not skip and evidence it needs before saying “done.”**

## Pick a problem

### 01 / The screen loaded. Now what?

- [**ux-state-review**](skills/ux-state-review/SKILL.md) — Distinguish loading, unmet prerequisites, empty results, and failures. Check what the user sees and can do next.
- [**exploratory-ux-qa**](skills/exploratory-ux-qa/SKILL.md) — Explore user journeys in a real browser and retain screen and network evidence.
- [**browser-e2e-review**](skills/browser-e2e-review/SKILL.md) — Include processing, failure, recovery, and visual changes in E2E review.

### 02 / More reviewers won't fix missing evidence.

- [**review-orchestrator**](skills/review-orchestrator/SKILL.md) — Classify change risk and select relevant specialist reviews. Finding count is not a quality metric.
- [**review-verifier**](skills/review-verifier/SKILL.md) — Recheck findings against original sources and counterevidence. An AI saying “bug” doesn't make it one.
- [**review-explainer**](skills/review-explainer/SKILL.md) — Connect causes, state, and before/after behavior so someone unfamiliar with the project can understand the review.

### 03 / Clicking the button once isn't a test strategy.

- [**testing**](skills/testing/SKILL.md) — Choose valuable unit, integration, mock, and database testing procedures by contract and risk, not coverage targets. Available as the [testing pack](packs/testing-pack.json).
- [**test-behavior-flows**](skills/test-behavior-flows/SKILL.md) — Verify connected behavior across interactions, asynchronous work, recovery, and data consistency.
- [**review-failure-resilience**](skills/review-failure-resilience/SKILL.md) — Review timeouts, retries, duplicate effects, partial failures, and recovery paths.
- [**web-operations-qa**](skills/web-operations-qa/SKILL.md) — Investigate production performance, caches, API latency, and background work using actual evidence.

### 04 / “Done” is doing a lot of work in that sentence.

- [**development-status**](skills/development-status/SKILL.md) — Turn change, verification, and deployment evidence into a clear account of progress and decisions needed.
- [**preserve-decisions**](skills/preserve-decisions/SKILL.md) — Carry scope, decisions, evidence, and uncertainty into the next task or session.
- [**langfuse-trace-review**](skills/langfuse-trace-review/SKILL.md) — Inspect actual requests, responses, tool results, and the limits of the trace sample.

**[Browse all skills →](skills/)** · **[Browse packs →](packs/)**

This is a problem-first entry point, not the entire catalog. Book-derived workflows and imported skills are credited below.

## One empty screen. Four different situations.

| State | What the interface should do |
| --- | --- |
| Still loading | Show progress. Don't declare the result empty. |
| Successfully loaded, no results | Offer a way to create the first item or change the search. |
| Missing permission | Explain the required access and the available next action. |
| Request failed | Acknowledge the failure and offer a retry when it can help. |

**Clicking “Retry” doesn't magically grant permission.**

[`ux-state-review`](skills/ux-state-review/SKILL.md) checks whether the copy, interface, requests, and transitions agree about the state—not just whether a button looks right.

## Use it

**No installation needed to read a skill.** Open any `SKILL.md` linked above.

To use the catalog through an agent, follow [gisul's runtime connection guides](https://github.com/changeroa/gisul#get-started). This repository holds the instructions. gisul provides the server and clients that discover and deliver them.

Example request for a connected agent:

> Find and read ux-state-review on Gisul. Review this signup flow's loading, verification-pending, failure, and re-entry states. Separate verified evidence from unchecked assumptions.

Keep the selected skill and supporting material pinned to the same commit. Skills are instructions, not permission grants. Your environment still controls tool access and execution authority.

## Contribute a skill

Skip the “You are the world's greatest expert” preamble. Give us:

1. **When to use it.** Applicable situations—and situations it should stay out of.
2. **What to do.** A procedure connecting inputs, state, actions, and outcomes.
3. **How to verify it.** Completion evidence and explicit limits on what was checked.
4. **Where it came from.** References, upstream sources, and the scope of your changes.

```sh
git clone https://github.com/changeroa/gisul-skills.git
cd gisul-skills
npm ci
npm run verify
```

`verify` prepares the same commit-pinned gisul server and Worker used by CI,
installs Chromium, then validates the catalog and runs the complete test suite.
Use `npm run test:unit` for checks that do not need that runtime, or
`npm run test:integration` after preparation. `npm test` still runs the complete
suite and reports missing runtime prerequisites before starting it.

The validator checks discovery rules such as frontmatter, matching names and directories, file counts, and size limits. **Passing format validation does not prove a skill is effective.** See the [technical reference](docs/technical-reference.md) for detailed limits and server integration test configuration.

## Don't erase the people you learned from.

Not every skill in this repository was created here from scratch.

- **Paperthin:** Imported skills including `re0`, `hate`, `feynman`, and `mandela` originate from [LilMGenius/paperthin](https://github.com/LilMGenius/paperthin). They are not included in the featured selection above. Their authors' work is not presented as this project's original invention.
- **Book-derived workflows:** The `clean-code` family and `dont-make-me-think` draw on the books and principles identified in their skill files. They are not official products or endorsements from those authors.
- **Import records:** [migration/import.json](migration/import.json) records original resource URIs. [aliases.json](aliases.json) records adopted URI mappings. A URI record alone does not establish copyright or licensing terms.

Check each item's provenance and applicable terms before reuse. Importing content and publishing it to a live server are separate operations.

---

**Instructions you can read. Results you can check.**

[gisul](https://github.com/changeroa/gisul) · [All skills](skills/) · [Quality](docs/quality.md) · [Releases](docs/releases.md) · [Issues](https://github.com/changeroa/gisul-skills/issues)
