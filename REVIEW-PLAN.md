# LabCAT pre-release review — findings & action plan

Working document for the release review (started 2026-06-10). Findings are logged per
chunk as the review progresses; the **Actions** section is the to-do list to revisit
at the end of the review before release.

## Review progress

- [x] Chunk 1 — Happy-path walkthrough (Overview → Export). **Passed**: full assessment
  built end to end, zero console errors, valid DOCX produced, 248/248 storage
  regression cases pass.
- [x] Chunk 2 — Correctness of chemistry outputs. **Passed**: nitric acid routed to
  oxidizing-acids double containment with isolation notes; compatibility matrix marks
  oxidising acids × organic solvents incompatible; probe script (chloroform → volatile
  poisons, amines flagged "separate from acids") all sensible; EH40 spot checks
  (acetone, toluene, chlorine, formaldehyde, sulphuric mist) match published HSE
  values; COSHH Essentials banding correct (H330 → group D/Approach 3, H372 → group
  D/Approach 2 with assumed-dustiness flagged, ethanol → group A/Approach 1).
- [x] Chunk 3 — Outputs. **Passed**: app print flow produces a clean 8-page A4 PDF
  (no blank pages, sections paginate in order, signature renders on the briefing
  page); DOCX is valid and complete (per-chemical detail incl. nitric acid, COSHH
  Essentials tables, storage assignments, signature image, 11 media files);
  `.labcatdraft` export/import round-trips into a fresh browser correctly.
  Note: printing via `page.pdf()` *without* the in-app Print button produces a layout
  with a leading blank page — only the in-app flow sets `body.report-printing`. Not a
  user-facing issue. Repro script kept at `app/scripts/review-print-pdf.mjs`.
  Report/DOCX "REF —" confirms action 1.
- [x] Chunk 4 — Unhappy paths. **Mostly passed**: refresh restores the full draft and
  privacy ack; with PubChem unreachable the autocomplete degrades to a plain "Look up
  on PubChem" option and the failed lookup shows an inline error without crashing;
  manual completion (CAS, quantity, WEL "n/a") still possible; negative quantities are
  rejected by the input filter; sidebar steps are properly `disabled` until previous
  sections complete (no bypass). New findings → actions 4–5 and notes below.
- [x] Chunk 5 — UI polish. **Passed at desktop & tablet**: Overview, Emergency,
  Briefing, Storage, Settings and report dialog all render cleanly at 1280 and 768
  wide (storage table scrolls horizontally as intended); long titles ellipsise in the
  top bar. Mobile (375px) is broken — sidebar doesn't collapse (see decision below).
  Copy findings → action 6.

## Actions (fix before release)

### [x] 1. Remove `riskAssessmentRef` and rename exported files
The field exists in the data model but no UI ever sets it, so the report header REF is
always "—" and every export is named `LabCAT-untitled-<date>.docx`.

- Remove `riskAssessmentRef` from `app/src/types/assessment.ts` (field + default),
  `app/src/components/layout/TopBar.tsx:21`, and the "Ref" row in
  `app/src/components/report/ReportPreview.tsx:318`.
- Check `app/src/services/exporters/docx.ts` and `migrate.ts` for other references.
- Base the export filename on the RA title instead, in
  `app/src/services/exporters/_filename.ts`:
  slugified `overview.raTitle` (fallback `untitled`), e.g.
  `LabCAT-Recrystallisation_of_benzoic_acid-20260610.docx`. Keep the existing
  character sanitisation and length-cap the slug (~60 chars).

### [x] 2. Multi-word chemical-name extraction misses (e.g. "benzoic acid")
Root cause: `app/src/services/extractChemicals.ts` only matches names/aliases from
EH40 (`eh40.json`). Substances without a UK WEL — benzoic acid included — can never be
suggested, regardless of word count. The matcher itself already handles multi-word
terms (index is sorted longest-first).

- Fix: extend the extraction index with the local CAMEO dataset
  (`app/src/data/cameo/chemicals.json` — already shipped, offline, has names + CAS).
  Keep EH40 entries as the preferred canonical source when both match.
- Guard against noise: keep the existing min-length ≥ 3 rule and require word-boundary
  matches; consider skipping very generic CAMEO names ("oil", "acid", single words
  that are also common English words).
- No PubChem network calls during typing — extraction should stay offline.

### [x] 3. Physical state: never silently default to "liquid"
Root cause: `app/src/components/sections/SubstancesSection.tsx:521` falls back
`pubchemPhysicalForm ?? form ?? 'liquid'`. When PubChem doesn't report a form (or
`parseForm` fails), a solid like benzoic acid is left as "liquid" with mL units, and
nothing prompts the user to check.

- Decision: when no form is known, leave the state **unselected** with a
  "— select —" placeholder option (same pattern as the Volatility select) and make it
  a required field that blocks step completeness until chosen.
- When PubChem *does* return a form, keep auto-filling it (and the matching units) as
  today.
- Update the chemical-details completeness check so an unselected state reads as
  missing ("chemical details" gate message should name it).

### [x] 4. Warn when a PubChem lookup resolves to a different name
Typing nonsense ("qwzzyblorp") and choosing `Look up "X" exactly` silently resolved to
an unrelated real compound (PubChem's name API does loose matching), renaming the
chemical and attaching that compound's data. A typo could attach the wrong hazard data
without the user noticing.

- Fix: after a lookup, compare the query against the returned title/IUPAC
  name/synonyms; if nothing is a close match, show a prominent "PubChem matched
  '<returned name>' — check this is the substance you meant" warning on the chemical
  card (in `app/src/services/pubchem.ts` / `SubstancesSection.tsx`).

### [x] 5. Friendlier lookup-failure message
When PubChem is unreachable the chemical card shows the raw error string
("Failed to fetch"). Replace with e.g. "PubChem could not be reached — check your
connection or enter the details manually."

### [x] 6. Copy fixes
- `ControlsSection.tsx:242` — "…document the final control measures in **the both the**
  Process steps…" → "in both the Process Steps section and the fields below".
- Help modal (`HelpSection.tsx`) — the UK WEL panel says "LabCAT cannot fetch these
  automatically — enter the values manually from EH40". This is stale: the app
  auto-fills TWA/STEL from its bundled EH40 dataset on PubChem lookup. Rewrite to
  describe the auto-fill and advise verifying against the current EH40 edition.
- Help modal says "Save Draft" but the top-bar button is labelled "Download LabCAT
  draft" — align the wording.

## Open decision — mobile support

At 375px the sidebar does not collapse and the content column is unusably narrow.
Decide before release: either (a) declare mobile out of scope (it's a lab/desktop
tool) and optionally add a "best viewed on a larger screen" notice, or (b) add a
collapsible sidebar breakpoint. Tablet (768px) works well as-is.

## Decisions — no change (by design)

- **Suggestion chips keep `[chemical]` placeholders.** Intentional: the chips give
  wording to consider, but the assessor must do the legwork and tailor it themselves.
  No auto-substitution.
- **PubChem fuzzy autocomplete ranking** (e.g. "Ethanolamine" above "Ethanol") is
  acceptable — the `Look up "X" exactly` option covers it.

## Deferred / nice-to-have

- No manual entry path for H-codes/pictograms: if PubChem is down or lacks GHS data,
  the chemical can be completed but hazard statements stay empty (SDS reference only).
  Consider a manual H-code picker eventually.
- No upper sanity bound on quantity (999,999,999 mL accepted). Screening treats large
  values conservatively, so low risk.
- Same-tick state updates can drop a toggle (store uses non-functional updates;
  observed via programmatic clicks only — unreachable by normal use). Consider
  functional `setState` in `app/src/store/assessment.ts` at leisure.
