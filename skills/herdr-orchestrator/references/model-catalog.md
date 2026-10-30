# Model catalog

Read this when selecting or reassigning a worker. This is a maintained starting
point for Codex assignments through Herdr. Explicit user constraints and the
target runtime's actual capabilities take precedence. Use the source commit,
deployment version, or resource digest supplied by the host as the catalog
identifier; this file needs no separate version counter.

## Model information

Checked on 2026-10-30 against model metadata available to Codex 0.166.0. The table
records advertised options in that observed environment, not account-independent
availability or a successful test of every combination. Check the consuming
environment through whatever metadata or execution feedback it provides; a
model-list API is not a prerequisite.

| Model ID | Advertised reasoning efforts |
| --- | --- |
| `gpt-6-luna` | `low`, `medium`, `high`, `xhigh`, `max` |
| `gpt-6.1-sol` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |
| `gpt-6-astra` | `low`, `medium`, `high`, `xhigh`, `max`, `ultra` |

**Cost evidence:** this catalog has no verified current prices or measured
per-task costs. The cost preference below is operator policy, not a price claim.
Record the provider, billing basis, source, and check date when adding prices;
do not translate subscription access into an assumed API charge.

**Benchmark evidence:** no comparative benchmark scores are asserted in this
initial catalog. Add source links and relevant run settings when using a public
benchmark. A published score does not establish performance in this workflow.

## Assignment policy

Initial policy agreed on 2026-10-30. These recommendations come from the
operator's intended division of work, not a controlled comparison. Prefer the
least expensive suitable choice using verified costs when available; the
initial operator cost preference is Luna, then Sol, then Astra. Capability,
acceptance criteria, and explicit user choices constrain that preference.

| Work and applicability | Preferred model / effort | Alternative or escalation |
| --- | --- | --- |
| Scoped lookup, summary, or repetitive edits: sources and expected output are clear; results can be checked directly; causal diagnosis is not central. | `gpt-6-luna` / `medium` | `gpt-6.1-sol` / `medium` if Luna is unavailable or core factual errors recur after missing context is supplied. If the task becomes ambiguous diagnosis, reassess against that row. |
| Bounded implementation and tests: owned files, dependencies, and acceptance checks are defined. | `gpt-6.1-sol` / `medium` | Sol / `high` for persistent reasoning difficulty; `gpt-6-astra` / `medium` when difficult diagnosis or integration decisions emerge, or when Sol is unavailable and Astra is suitable. |
| Ambiguous design, difficult diagnosis, high-risk review, or integration decisions: conflicting evidence or significant cross-component judgment. | `gpt-6-astra` / `medium` | Astra / `high` for unresolved reasoning difficulty. If Astra is unavailable, consider Sol / `high` only when narrowing the assignment preserves its acceptance criteria; otherwise report the limitation. |

Use supported efforts only. An advertised automatic-delegation mode does not
expand a worker's assignment or permission to create more agents. An existing
worker's previous model is not automatically suitable for its next task.

Keep selection and failure handling brief:

- Use the applicability conditions, not a task label alone. Extracting log
  timestamps is different from deciding which event caused a delivery delay.
- Repair tool/command errors and supply missing context before treating a
  failure as evidence that a stronger model is needed.
- When escalating, preserve the investigation, exact failures, and remaining
  question. Verify the new session's actual model and effort when observable.
- If no listed choice fits, record the limitation or a justified selection
  within the user's constraints. Do not silently fall back to a global default.

## Maintenance

Update model facts from authoritative documentation or observed runtime
metadata, recording the source and date. Update assignment policy from relevant
benchmarks and actual work experience, with a short reason and the scope of the
change. A new model may be added as a candidate while defaults remain unchanged.

Use the repository's existing Git and MCP release process. A commit message or
existing release note can hold the change reason; no separate evaluation
framework or changelog is required. Record the catalog identifier used for an
assignment. If changing it during a goal, load the new resource and record the
change explicitly. Detailed evaluation records need not be loaded by workers.
