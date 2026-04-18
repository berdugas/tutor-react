# Plan: TICKET_0008 — Pass 1B Topic Extraction Restructure

**Ticket:** TICKET_0008_pass1b_topic_extraction_restructure.md
**Date:** 2026-04-18
**Status:** Awaiting Approval

## Summary

Restructure two rule blocks in `buildPass1bPrompt()` and add a subject-aware helper, fixing five diagnosed problems that cause Pass 1B to extract activity titles instead of concept names. One file only: `src/prompts/pass1.js`.

## Implementation Plan

### Phase 1 — Add `buildPass1bSubjectNote()` helper

- [ ] Add non-exported helper function immediately before `buildPass1bPrompt()`, following the exact same pattern as `buildSubjectContext()` in `pass2.js` (object lookup + default fallback)
- [ ] Covers all four subjects: Filipino, Mathematics, Science, Araling Panlipunan
- [ ] AP note explicitly permits proper nouns (Rizal, Bonifacio, Intramuros) as valid vocabulary
- [ ] Math/Science notes list subject-specific section headers to ignore as topics

### Phase 2 — Inject subject note into prompt

- [ ] Add `const subjectNote = buildPass1bSubjectNote(selectedSubject)` after `historyNote` declaration
- [ ] Inject `${subjectNote}` between `${historyNote}` and the extracted text block

### Phase 3 — Replace TOPIC EXTRACTION RULES block

- [ ] Remove the existing 6-bullet rule list entirely
- [ ] Replace with the reasoning-first block from the ticket spec:
  - Concept vs activity title distinction with the pantig example
  - Three-step lookup sequence (body text definition → bold exercise title → two-column comparison)
  - Explicit ignore list (section headers + activity verb titles + story titles)
  - Topic format guidance (4-8 words, language by subject)

### Phase 4 — Replace VOCABULARY EXTRACTION RULES block

- [ ] Remove the existing 5-bullet rule list entirely
- [ ] Replace with the subject-aware block from the ticket spec:
  - AP proper noun exception explicitly named
  - "Props in example sentences" exclusion with the kalabaw example
  - "salita"/"pangungusap" as meta-language exclusion

### Phase 5 — Completion file

- [ ] Write completion doc

## Files to Be Created / Modified

| File | Action | Purpose |
|---|---|---|
| `src/prompts/pass1.js` | Modify | Add helper + inject subject note + replace two rule blocks |
| `docs/TICKET_0008_..._completion.md` | Create | Completion record |

## Design System Compliance

Not applicable — no UI or CSS changes.

## Dependencies and Risks

- `buildPass1aPrompt()` is untouched — Pass 1A is working correctly
- JSON output schema is unchanged — no downstream impact on `useAnalysis.js`
- The `historyNote` variable already exists in the function and is the correct injection anchor
- `buildPass1bSubjectNote()` is module-private (not exported) — consistent with `buildWorkedExampleNote()` in `pass2.js`

## Estimated Scope

- **Files affected:** 1
- **Complexity:** Low — specification is exact, no ambiguity
