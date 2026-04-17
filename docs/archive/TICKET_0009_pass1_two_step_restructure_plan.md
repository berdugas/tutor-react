# Plan: TICKET_0009 — Pass 1 Two-Step Restructure: Extract Then Analyze

**Ticket:** TICKET_0009_pass1_two_step_restructure.md
**Date:** 2026-04-14
**Status:** Awaiting Approval

## Summary

Split the single Pass 1 Kimi call into two focused calls: Step 1A reads the image
and returns extracted text only; Step 1B analyzes the clean text (no image) and
returns the structured JSON. This fixes vocabulary and topic extraction quality
without any new services.

## Implementation Plan

### Phase 1: Prompts
- [ ] Replace `buildPass1Prompt` in `pass1.js` with `buildPass1aPrompt` and `buildPass1bPrompt`
- [ ] Add `extractedText` parameter to `buildFlashcardPrompt` in `flashcards.js`

### Phase 2: Hook
- [ ] Update import in `useAnalysis.js`: `buildPass1Prompt` → `buildPass1aPrompt, buildPass1bPrompt`
- [ ] Replace `runPass1()` with two-step version (Step 1A: callWorker 600 tokens, Step 1B: callWorkerText 800 tokens)
- [ ] Update `generateFlashcards` to pass `check.extracted_text || ''` to prompt

## Files to Be Created / Modified

| File | Action | Details |
|---|---|---|
| `src/prompts/pass1.js` | Modify | Replace single function with two focused builders |
| `src/prompts/flashcards.js` | Modify | Add extractedText parameter |
| `src/hooks/useAnalysis.js` | Modify | Two-step runPass1, updated import and generateFlashcards |

**Do NOT modify:** pass2.js, AppContext.jsx, useSession.js, useRag.js, api.js, worker/index.js

## Estimated Scope
- **Files affected:** 3
- **Complexity:** Medium
