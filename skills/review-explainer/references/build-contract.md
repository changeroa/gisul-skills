# Build the approved document layout

The bundled asset reproduces the document shell, progressive disclosure, name bridge, large single-diagram default, paired comparison, search/filter/navigation, mobile reading, enlargement and exports. It is an HTML document, not a slide deck. The builder does not infer facts or render UML: author and verify the content and SVGs first.

Materialize the selected asset and script under a task output directory, keeping `assets/` and `scripts/` relative paths. Do not install another copy of the remote workflow skill. Use Python 3.9+ and its standard library:

```sh
python3 scripts/build_explainer.py findings.json output/index.html --source-root /path/to/pinned/source
python3 -m http.server 8766 --bind 127.0.0.1 --directory output
```

Choose an unused port and a persistent process when delivering the preview. `--source-root` checks the literal anchor at the provided line. It does not prove the surrounding call relationship or source revision; verify those separately. Omit it only when local source is unavailable, and record the resulting limitation.

## Input

JSON object with `metadata` and a nonempty `findings` array. Keep project-specific content in the input; do not rewrite layout code for counts or identifiers.

### Metadata

Required: `project`, `reviewRevision` (full pinned revision), `reviewDate`, `scope` (which findings/report this covers). Optional strings: `intro`, `systemHint`, `glossary`, `footnote`. Use the reader's language. The bundled interface is Korean; adapt interface copy if a different language is requested.

Counts and available UML filters are derived. Do not carry a previous project's name, date, 22 findings, 86 terms or assumptions into a new report.

### Each finding

| Field | Contract |
| --- | --- |
| `id`, `title`, `group` | Stable safe ID, concrete reader-facing title, related category |
| `status` | `CONFIRMED`, `NEEDS_CONTEXT`, or `REJECTED` |
| `severity` | Required for confirmed findings; retain the review's own severity |
| `reader` | See below |
| `codeTerms` | Nonempty name/meaning/source array; see below |
| `contexts` | Optional detailed location/lifetime cards |
| `diagramType` | `sequence`, `activity`, `state`, `object`, `component`, `deployment`, `class` |
| `diagramLabel`, `diagramQuestion`, `diagramReason`, `diagramLegend` | Type name, question the picture answers, selection rationale, notation/arrow semantics |
| `beforeSvg`, `afterSvg` | Inline SVG strings with responsive `viewBox`, accessible title/label, correct type-specific notation |
| `beforeReading`, `afterReading` | Nonempty arrays conveying the same diagram in readable text |
| `beforeOutcome`, `afterOutcome` | Consequence / expected result and conditions |
| `beforeSpec`, `afterSpec` | Exportable typed definitions matching the rendered diagram |
| `proposalNames` | Which names/actions are proposed or unverified |
| `change`, `trigger`, `suggested_test` | Change or judgment rationale; trigger array; verification proposal |
| `human_check` | Required for `NEEDS_CONTEXT`: unresolved decision or measurement |
| `verification` | Object with `observed` text and optional `label` describing actual verification scope |
| `source`, `primary_location` | Pinned HTTPS source link and `{path, start_line}` |

`reader` contains `scene`, `normal`, `key`, `focus` strings; `roles` array of `{name, where, role}`; `before` and `after` arrays. These are authored explanations, not automatic summaries of SVG labels. Use a few causal steps, retaining essential conditions.

`codeTerms`: `{name, meaning, source: {path, line, url}, match?}`. `name` preserves the identifier shown in the diagram. `meaning` explains location and purpose. `url` is a pinned source link. `match` is the exact source substring for a qualified or composite display name whose full text does not occur on one source line. A match is a location check, not proof of semantics.

`contexts`: `{name, where, data, update, why, refs: [{path, line, url}]}`. Include only details needed to distinguish ownership, storage, copies and lifetimes. Do not use a fabricated URL for unknown source; resolve the evidence or adapt the unverified output explicitly before building.

## Diagrams and exports

Use an appropriate renderer or authored SVG. Preserve semantics independently of the renderer; no tool is mandatory. Keep SVG self-contained without scripts, external images, links or embedded HTML. The builder refuses executable/external SVG content. Names inside SVG must remain literal; explain them outside the diagram. Namespace SVG IDs by finding and side to avoid duplicate markers when comparing both.

Every spec has `id`, `side` (`before` or `after`), `type`, and `sourceRevision` matching the metadata. Add `status` (`observed-source`, `proposal`, or `reverification`) and the diagram's `question` when useful.

- Sequence: `participants` string array and `messages` arrays `[fromIndex, toIndex, label, kind]`. Kinds may include `call`, `return`, `issue`, `fix`. Render participant lifelines and correct message/return meaning. Interactive groups use `.message`, `data-step`, keyboard focus and an accessible label; SVG has `data-side`.
- Other UML types: `nodes` with stable `id`, `label`, `kind`, optional `fields`; `edges` with `a`, `b`, `label`, and semantic style/tone when needed. Draw shapes that belong to the selected UML. Interactive node groups use `.node`, `data-node` and accessible focus; SVG has `data-side`. A diagram title alone does not make generic boxes a valid UML type.
- Interactions are optional in the SVG authoring. If no interactive nodes exist, adapt the viewer hint accordingly; do not advertise buttons that do nothing. The default examples from the approved output use both sequence and graph highlighting.

The script checks input shape, XML, definition types, references and endpoints. It produces `index.html` and `index.receipt.json`. Browser/semantic/reader checks remain mandatory; consult `quality-gates.md`. Validate extracted JavaScript using an available runtime, open the exact served artifact with Aside, and store the actual evidence. Do not call the build receipt a browser or comprehension pass.

## Reuse and changes

For an existing compatible explainer, reuse its reviewed findings JSON and fixed source snapshot. Supply metadata, then build into a separate preview directory. Compare the first screen, technical name bridge and all UML types before replacing the delivered file. Keep the prior accepted artifact recoverable. Do not replace accepted prose with raw identifiers, collapse all UML to one type, or adopt slide pagination merely because the renderer can do it.
