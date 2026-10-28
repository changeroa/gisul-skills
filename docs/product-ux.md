# Product UX

[한국어](product-ux.ko.md) · [Pack definition](../packs/product-ux-pack.json)

Separate finding a usability problem from designing its solution. Load only the specialists needed for the current decision.

| Skill | Responsibility |
| --- | --- |
| [`product-ux`](../skills/product-ux/SKILL.md) | Choose scope and relevant specialist procedures |
| [`interface-architecture`](../skills/interface-architecture/SKILL.md) | Information structure, navigation, screen types and workflow |
| [`interface-layout`](../skills/interface-layout/SKILL.md) | Visual hierarchy, density, grids and responsive layout |
| [`collection-data-design`](../skills/collection-data-design/SKILL.md) | Lists, tables, search, selection and data exploration |
| [`form-command-design`](../skills/form-command-design/SKILL.md) | Forms, controls, validation, commands and recovery |
| [`interaction-feedback`](../skills/interaction-feedback/SKILL.md) | Loading, refresh, saving, notifications, motion and loops |
| [`experience-mapping`](../skills/experience-mapping/SKILL.md) | Cross-role and cross-channel experiences, handoffs and activation |
| [`ui-pattern-systems`](../skills/ui-pattern-systems/SKILL.md) | Pattern selection, composition and system governance |
| [`ux-content`](../skills/ux-content/SKILL.md) | Terminology, voice, UI text, states, errors and localization |
| [`ux-research`](../skills/ux-research/SKILL.md) | Questions, methods, recruitment, facilitation, synthesis and decisions |

## Existing procedures stay separate

- `dont-make-me-think`: screen-based heuristic usability review.
- `ux-state-review`: consistency between domain states, permissions, prerequisites, screens and requests.
- `browser-e2e-review` and `exploratory-ux-qa`: authorized browser execution and screen/network evidence.
- `preserve-decisions`: selected designs, requirements and evidence carried into implementation and handoffs.

Human research needs real participants and consent. Agent exploration, format checks, functional correctness and human understanding are not interchangeable evidence. Reading a pack does not authorize implementation, outreach, publication or deployment. Report design, implementation, executed verification, unchecked scope and deployment separately.

For a loading-only change, start with `interaction-feedback`, not a dashboard redesign. For onboarding structure, start with `interface-architecture`; add mapping only when cross-role or operational handoffs need investigation. For table selection and bulk actions, combine `collection-data-design` and `form-command-design`.
