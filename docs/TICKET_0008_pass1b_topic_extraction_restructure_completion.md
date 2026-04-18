# Completion: TICKET_0008 — Pass 1B Topic Extraction Restructure

**Ticket:** TICKET_0008_pass1b_topic_extraction_restructure.md
**Date:** 2026-04-18
**Status:** Complete

## What Was Done

Restructured `buildPass1bPrompt()` in `pass1.js` to fix five diagnosed problems that caused Pass 1B to extract activity titles instead of concept names. Added a subject-aware helper function and replaced two brittle rule blocks with reasoning-first guidance.

## Changes Made

| File | Action | Details |
|---|---|---|
| `src/prompts/pass1.js` | Modified | Added `buildPass1bSubjectNote()` helper (private); added `subjectNote` injection; replaced TOPIC EXTRACTION RULES block; replaced VOCABULARY EXTRACTION RULES block |

## Final prompt section order in `buildPass1bPrompt()`

1. Role + student profile
2. `profileNote`
3. `historyNote`
4. `subjectNote` ← new
5. Extracted text block
6. `TOPIC EXTRACTION — REASONING FIRST` ← replaced
7. `VOCABULARY EXTRACTION RULES` ← replaced
8. JSON output schema (unchanged)

## Design System Compliance Check

- [x] No UI or CSS changes — not applicable
- [x] No new exported functions — `buildPass1bSubjectNote()` is module-private
- [x] `buildPass1aPrompt()` untouched
- [x] JSON output schema unchanged — all existing fields present, no new fields
- [x] No other files modified

## Deviations from Plan

None — executed exactly as specified in the ticket.

## Acceptance Criteria Check

- [x] `buildPass1bSubjectNote()` exists as a non-exported helper in `pass1.js` (line 36)
- [x] TOPIC EXTRACTION RULES block fully replaced with reasoning-first block
- [x] VOCABULARY EXTRACTION RULES block fully replaced with subject-aware block
- [x] `subjectNote` injected between `historyNote` and extracted text block (line 105)
- [ ] Test scan "Pagbasa ng mga Salitang may Tatlo o Higit Pang Pantig" → topic "Pantig" — requires live test
- [ ] Test scan Filipino grammar worksheet → correct concept topic — requires live test
- [ ] Test scan Mathematics worksheet → English-language topic name — requires live test
- [x] `buildPass1aPrompt()` unchanged
- [x] JSON output schema unchanged
- [ ] `npm run build` passes — requires build verification

## Notes for Product Lead

- The AP proper noun exception is explicit in both `buildPass1bSubjectNote('Araling Panlipunan')` and the new VOCABULARY EXTRACTION RULES block — two reinforcements so the model doesn't fall back to the old "no proper nouns" rule for AP.
- The pantig example is embedded directly in the TOPIC EXTRACTION reasoning block as a concrete illustration of the activity-title vs concept-title distinction.
- The `kalabaw` example in VOCABULARY EXTRACTION teaches the model to distinguish "props in example sentences" from actual vocabulary terms — this generalizes to all subjects.
