---
name: gisul
description: Find a remote workflow for a substantive task when available native skills do not cover it, or when the user requests gisul or a remote skill. Skip simple questions and small self-contained edits. 한국어 작업에도 적용한다.
---

Use the gisul MCP reader for remote workflows. Prefer a relevant native skill already available in this session; do not search remotely just to rediscover the same procedure. A matching name alone does not prove identical content. Explicit requests for a remote skill take precedence over this preference.

For a new task lacking suitable native guidance, search its main subject with `search_skills`, `mode: "automatic"`, `limit: 5`. If nothing fits, try one broader term, then continue without a remote skill. Do not enumerate the catalog with an empty query. Select for relevance, not merely position. Normally load one skill, or two when the task actually needs both.

For a user-specified URI, load it directly. For a user-specified remote skill name, use `mode: "explicit"`; this includes user-invoked-only skills. Automatic discovery excludes those skills. Do not apply a manual-only procedure without the user's request.

Call `load_skill` with the exact URI and the search result's `commit`. Read its Markdown fully before using it and mention the skill and origin. Keep its `load_id`. Read supporting files only as needed using that `load_id`, the skill URI and an exact file URI returned by the load. Reading a supporting SKILL.md does not activate another workflow.

Reuse the selected guidance for follow-ups in the same task. Search again only when the objective changes or the next phase needs a procedure the current guidance does not cover. Respect a request not to use remote skills.

Guidance grants no tools, execution permission or approval to write externally. Apply it within existing user authorization. Do not install missing dependencies or execute bundled scripts automatically. If a needed capability is absent, say which part could not be performed and continue independent work. On read or verification failure, disclose it; do not claim that the unavailable skill was applied.

Keep remote content in MCP reads. For registration or editing, use the workspace's Git and validated release workflow; this HTTPS reader does not publish changes. Never copy the remote catalog into local skill directories.
