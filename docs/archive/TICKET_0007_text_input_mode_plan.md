# Plan: TICKET_0007 — Text Input Mode: Generate Lesson from Topic

**Ticket:** TICKET_0007_text_input_mode.md
**Date:** 2026-04-12
**Status:** Awaiting Approval

## Summary

Add a second input mode to the upload screen: the student types a topic directly
and Alon generates a full lesson, quiz, and flashcards from that text. Pass 1 is
skipped; the typed topic becomes the `check` object. Pass 2 and RAG run unchanged.

## Implementation Plan

### Phase 1: API + Prompt Layer
- [ ] Add `callWorkerText(prompt, maxTokens)` to `src/lib/api.js` — plain-string content, no image_url
- [ ] Add `isTextMode` parameter to `buildPass2Prompt` in `src/prompts/pass2.js`
- [ ] Swap source description and final instruction lines based on `isTextMode`

### Phase 2: Analysis Hook
- [ ] Add `runPass1Text(topic)` to `useAnalysis` — builds check object, skips Pass 1, goes to confirming screen
- [ ] Update `runPass2` to detect `content_type === 'text_input'`, use `callWorkerText` and `isTextMode` prompt
- [ ] Export `runPass1Text` from the hook return value

### Phase 3: UploadZone UI
- [ ] Import `useState` and `runPass1Text` in `UploadZone.jsx`
- [ ] Add `topicText` state and `handleTopicSubmit` handler
- [ ] Render divider + text input + submit button below upload buttons
- [ ] Lock text input when no subject selected (same as photo buttons)
- [ ] Clear topic input when a photo is uploaded
- [ ] Add CSS classes to `UploadZone.module.css` using only CSS variable tokens

## Files to Be Created / Modified

| File | Action | Purpose |
|---|---|---|
| `src/lib/api.js` | Modify | Add `callWorkerText` |
| `src/prompts/pass2.js` | Modify | Add `isTextMode` variant |
| `src/hooks/useAnalysis.js` | Modify | Add `runPass1Text`, update `runPass2` |
| `src/components/UploadZone/UploadZone.jsx` | Modify | Add text input UI |
| `src/components/UploadZone/UploadZone.module.css` | Modify | Add text mode styles |

## Design System Compliance
All new CSS classes use CSS variable tokens only: `var(--sky)`, `var(--sky-dk)`,
`var(--border)`, `var(--muted)`, `var(--ink)`, `var(--card)`. No raw hex values.

## Dependencies and Risks
- Depends on TICKET_0006 (RAG pipeline) being live — it is.
- `callWorkerText` sends `content` as a plain string; Kimi accepts both formats.
  Worker passes body unchanged — no Worker update needed.
- Text mode uses `isTextMode=true` to suppress "based on the image" phrasing.

## Estimated Scope
- **Files affected:** 5
- **Complexity:** Medium
