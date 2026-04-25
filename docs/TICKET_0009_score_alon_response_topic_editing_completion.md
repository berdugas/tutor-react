# Completion: TICKET_0009 — Score-Based Alon Response + Confirmation Card Topic Editing

**Ticket:** TICKET_0009_score_alon_response_topic_editing.md
**Date:** 2026-04-18
**Status:** Complete

## What Was Done

Part A: QuizView now shows a tier-appropriate Alon speech bubble above the score number, a "Basahin muli ang leksyon" button for scores ≤ 2/5, and softer wrong-answer feedback. Part B: ConfirmationCard has a new editable PAKSA (topic) row as the first row, with a text input that commits to `pendingCheck` in AppContext.

## Changes Made

| File | Action | Details |
|---|---|---|
| `src/components/QuizView/QuizView.jsx` | Modified | Added `getAlonMessage()` function; added `onGoToLesson` prop; added Alon bubble + review button to score card; changed wrong answer prefix to `💛 Almost! `, correct to `✅ Tama! ` |
| `src/components/QuizView/QuizView.module.css` | Modified | Added `.alonBubble`, `.alonBubbleIcon`, `.alonBubbleText`, `.reviewBtn` |
| `src/components/LessonOutput/LessonOutput.jsx` | Modified | Pass `onGoToLesson={() => setActiveTab('lesson')}` prop to QuizView |
| `src/components/ConfirmationCard/ConfirmationCard.jsx` | Modified | Added `setPendingCheck` from context; `currentTopic` local state; `handleTopicChange` + `handleTopicBlur` handlers; topic row as first row |
| `src/components/ConfirmationCard/ConfirmationCard.module.css` | Modified | Added `.rowTopicEdit`, `.topicInput` |

## Design System Compliance Check

- [x] All new CSS uses `var(--token)` only — no hardcoded hex values
- [x] No new components — existing files only
- [x] No prompt files modified
- [x] No `useAnalysis.js` changes — Pass 2 already reads from `pendingCheck.topic`
- [x] `setPendingCheck` uses spread pattern: `prev => ({ ...prev, topic: trimmed })`

## Deviations from Plan

None — executed exactly as specified in the ticket.

## Acceptance Criteria Check

### Part A
- [x] Score 5/5: "Kahanga-hanga, [name]! Lima sa lima — perpekto! Patuloy lang!"
- [x] Score 4/5: "Napakagaling, [name]! Halos perpekto…"
- [x] Score 3/5: "Magaling, [name]! Tatlo ang tama…"
- [x] Score 0–2/5: "Okay lang yan, [name]!…" + "Basahin muli ang leksyon" button visible
- [x] "Basahin muli" button calls `onGoToLesson()` → switches tab to 'lesson'
- [x] Wrong answer prefix: `💛 Almost! `
- [x] Correct answer prefix: `✅ Tama! `
- [x] Score card layout: Alon bubble → emoji → score number → message → Tala → button
- [x] No hardcoded hex in new CSS

### Part B
- [x] PAKSA row is first row in confirmation card
- [x] Shows detected topic from `pendingCheck.topic`
- [x] Tapping opens text input with current topic pre-filled (`autoFocus`)
- [x] Blurring commits non-empty value to `pendingCheck` via spread pattern
- [x] Edited row shows ✓ indicator
- [x] Empty input on blur reverts to original detected topic
- [x] No hardcoded hex in new CSS

## Notes for Product Lead

- The `getAlonMessage` tier boundary for "strong" is `score >= 4` (4 or 5 correct), matching the ticket's 4/5 row. Perfect (5/5) is checked first, so 5/5 always gets the perfect message.
- The "Basahin muli" button only renders when both `score <= 2` AND `onGoToLesson` is provided — future-safe if QuizView is ever embedded without a tab context.
- `currentTopic` is initialized once from `pendingCheck?.topic` at mount. If Pass 1B produced no topic, it defaults to an empty string and the row shows blank until the user fills it in.
