# Standalone UML and object design pack

[한국어](object-design.ko.md) · [Pack definition](../packs/object-design-pack.json)

This is a separate, self-contained pack. It does not require Clean Code, testing, frontend, or any other skill pack. Its own skills handle scope, execution coordination, and verification.

| Skill | Responsibility |
| --- | --- |
| [`object-design`](../skills/object-design/SKILL.md) | Scope, mode and purpose of the models |
| [`object-design-workflow`](../skills/object-design-workflow/SKILL.md) | Risk-driven iterations and executable feedback |
| [`uml-modeling`](../skills/uml-modeling/SKILL.md) | Diagram choice, notation, versions and consistency |
| [`use-case-modeling`](../skills/use-case-modeling/SKILL.md) | Actor goals, boundaries, scenarios, extensions and guarantees |
| [`domain-contract-modeling`](../skills/domain-contract-modeling/SKILL.md) | Conceptual models, system events and operation contracts |
| [`responsibility-design`](../skills/responsibility-design/SKILL.md) | Assigning responsibilities and collaborations |
| [`pattern-application`](../skills/pattern-application/SKILL.md) | Pattern selection, simpler alternatives and tradeoffs |
| [`architecture-modeling`](../skills/architecture-modeling/SKILL.md) | Quality drivers, architecture views and decisions |
| [`object-design-verification`](../skills/object-design-verification/SKILL.md) | Traceability, counterexamples and verification evidence |

Load only the specialists needed for the decision. A notation question does not require a complete set of use cases or architecture views. A conceptual model is not automatically a class design or database schema. Patterns and diagram counts are not quality targets.

Distinguish current implementation, observations, approved requirements and proposals. Syntax checks, rendering, semantic walkthroughs, code tracing and executed tests provide different evidence. This pack does not authorize source changes, external transmission, commits, pushes, publication or deployment.
