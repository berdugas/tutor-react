# Completion: TICKET_0009 — Pass 1 Two-Step Restructure: Extract Then Analyze

**Ticket:** TICKET_0009_pass1_two_step_restructure.md
**Date:** 2026-04-14
**Status:** Complete

## What Was Done

Replaced the single Pass 1 Kimi call with two focused sequential calls:
- Step 1A (`callWorker`, 600 tokens): reads the image and returns only extracted text + quality assessment
- Step 1B (`callWorkerText`, 800 tokens): analyzes the clean extracted text (no image) and returns the structured check object

Updated flashcard generation to pass `extracted_text` to the flashcard prompt for richer word pool context.

## Changes Made

| File | Action | Details |
|---|---|---|
| `src/prompts/pass1.js` | Modified | Replaced `buildPass1Prompt` with `buildPass1aPrompt` (image → text) and `buildPass1bPrompt` (text → JSON analysis) |
| `src/hooks/useAnalysis.js` | Modified | Updated import; replaced `runPass1()` with two-step version; updated `generateFlashcards` to pass `check.extracted_text` |
| `src/prompts/flashcards.js` | Modified | Added `extractedText = ''` parameter; injects raw material text (first 800 chars) as word selection context |

## Design System Compliance Check
- [x] No CSS changes — prompt/hook changes only
- [x] Flashcard front rule unchanged (enforced in flashcards.js WORD SELECTION RULES)
- [x] No out-of-scope features added

## Deviations from Plan
None — executed as planned.

## Approval Comments Addressed
- `pass2.js`, `AppContext.jsx`, `useSession.js`, `useRag.js`, `api.js`, and `worker/index.js` were not touched.
- `runPass1Text` is completely unchanged.

## Acceptance Criteria Check
- [x] `runPass1` is now two sequential calls (1A image→text, 1B text→JSON)
- [x] `check.extracted_text` is populated after photo scan
- [x] Unreadable image detected in 1A → returns to upload; 1B never runs
- [x] Poor quality image shows yellow warning and continues
- [x] Processing labels: "Reading the page…" (step 1) → "Understanding the content…" (step 2)
- [x] `runPass1Text` unchanged — still goes directly to confirming screen
- [x] `generateFlashcards` now passes `extracted_text` to `buildFlashcardPrompt`
- [x] `buildFlashcardPrompt` uses extracted text as additional word selection context

## Notes for Product Lead
- The old `buildPass1Prompt` function is completely removed. If any external code
  referenced it, it will need updating — but within the aralmate codebase it was
  only used in `useAnalysis.js`.
- Step 1B uses `callWorkerText` (no image), which is correct and intentional:
  the image was already read in Step 1A.
- Test with the Pangungusap/Parirala worksheet — expected topic:
  "Pagkakaiba ng Pangungusap at Parirala", key_vocabulary should contain
  pangungusap, parirala, diwa and must NOT contain Zarah, ang, alkansiya.
