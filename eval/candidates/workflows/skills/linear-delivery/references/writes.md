# Verified writes

Resolve the project by stable ID or an exact case-insensitive name match. If the
request requires exactly one match, zero or multiple matches stop creation.
Retrieve template content, state IDs and existing issues before changing anything.

For duplicate detection, use the project ID, source-plan relationship and title
normalized by Unicode NFKC, whitespace collapse and lowercase. Preserve meaningful
numbers and punctuation; removing parentheses, particles or release numbers can
collapse different tasks. A semantic match requires comparing scope/acceptance.
More than one plausible existing issue requires reconciliation, not another create.

Create only when absence is established. Update matching issues and preserve other
contributors' substantive requirements. Apply the actual team template on creation.

After a timeout, transport loss or 5xx, the write may have succeeded. Re-query the
affected issue or creation key before any retry. If found, verify/update that issue.
If the read also fails or remains ambiguous, stop dependent writes and report the
uncertain outcome. Do not repeat a create because the response was lost. At most
three write attempts per issue per run; reads must reconcile every uncertain one.

After saving, retrieve the issue and verify project, parent, blocking relations,
state and expected template fields. Inspect saved Markdown for real line breaks,
checkboxes and links. API readback verifies stored Markdown, not visual UI rendering;
if UI QA is required, use aside-browser. Report partial application explicitly.
