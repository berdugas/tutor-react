# Completion: TICKET_0007 — Text Input Mode: Generate Lesson from Topic

**Ticket:** TICKET_0007_text_input_mode.md
**Date:** 2026-04-12
**Status:** Complete

## What Was Done

Added a text input mode to the upload screen. Students can now type a topic
directly instead of uploading a photo. Pass 1 is skipped; the typed topic
becomes the `check` object and the flow goes straight to the confirmation card.
Pass 2 and RAG run normally, with a text-mode prompt variant that suppresses
all image references.

## Changes Made

| File | Action | Details |
|---|---|---|
| `src/lib/api.js` | Modified | Added `callWorkerText` — plain-string content, no image_url |
| `src/prompts/pass2.js` | Modified | Added `isTextMode` parameter; swaps `sourceDescription` and `sourceInstruction` based on mode |
| `src/hooks/useAnalysis.js` | Modified | Added `runPass1Text`; updated `runPass2` to detect text mode, use `callWorkerText` and `isTextMode` prompt; exported `runPass1Text` |
| `src/components/UploadZone/UploadZone.jsx` | Modified | Added `topicText` state, `handleTopicSubmit`, divider, text input, submit button; clears topic on photo upload |
| `src/components/UploadZone/UploadZone.module.css` | Modified | Added `.divider`, `.textMode`, `.textModeLabel`, `.topicInput`, `.topicBtn` — all using CSS variable tokens |

## Design System Compliance Check
- [x] All colors use `var(--token)` — no hardcoded hex values in new code
- [x] No new components created — existing component files modified only
- [x] Flashcard front rule not touched
- [x] No out-of-scope features added

## Deviations from Plan
None — executed as planned. The `textMode.locked` class disables both input
and button via CSS (matching the existing `uploadPrompt.locked` pattern) rather
than relying solely on the `disabled` attribute, giving a consistent visual lock.

## Approval Comments Addressed
- `pass1.js`, `AppContext.jsx`, `useSession.js`, `useStudentContext.js`, and
  `worker/index.js` were not touched.

## Acceptance Criteria Check
- [x] Text input field and "Pag-aralan Ito" button appear below the upload buttons
- [x] Text input is disabled when no subject is selected
- [x] Typing a topic and tapping the button goes to the confirmation card
- [x] Confirmation card shows the typed topic, subject, and grade correctly (uses existing ConfirmationCard with pendingCheck.topic)
- [x] Confirming runs Pass 2 and generates a full lesson with quiz and flashcards
- [x] The Pass 2 prompt does NOT say "based on the image" in text mode
- [x] RAG runs — `fetchCurriculumChunk` called in `runPass2` regardless of mode
- [x] Lesson saves to Supabase — `saveLesson` called in `runPass2` regardless of mode
- [x] Text mode lesson is indistinguishable from photo mode lesson in the UI
- [x] Uploading a photo clears the topic input (`setTopicText('')` in `handleFile`)
- [x] No new console error paths introduced

## Notes for Product Lead
- Both photo and text input are always visible simultaneously — consistent with
  the ticket spec.
- The divider uses `— o kaya —` (Filipino "or instead") as specified.
- `topicBtn` uses `color: var(--card)` (white) instead of the hardcoded `white`
  in the ticket spec, to stay fully within the design system.
- Test with: "Pang-uri", "Pagkakaiba ng Pangungusap at Parirala",
  "Kasaysayan ng Watawat ng Pilipinas", "Fractions Grade 4".
