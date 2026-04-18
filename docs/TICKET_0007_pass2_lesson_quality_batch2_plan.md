# Plan: TICKET_0007 — Pass 2 Lesson Quality: Batch 2 (Bilingual Bridging + Quiz Quality)

**Ticket:** TICKET_0007_pass2_lesson_quality_batch2.md
**Date:** 2026-04-18
**Status:** Awaiting Approval

## Summary

Add two named instruction constants to `buildPass2Prompt()` in `pass2.js`. No component changes, no JSON schema changes, no new files. Pure prompt engineering.

## Implementation Plan

### Phase 1 — Add constants to pass2.js

- [ ] Add `BILINGUAL_BRIDGING_NOTE` as a named constant immediately before `buildPass2Prompt()`
- [ ] Add `QUIZ_QUALITY_NOTE` as a named constant immediately after `BILINGUAL_BRIDGING_NOTE`
- [ ] Interpolate both into the return template string in this order:
  ```
  ${culturalAnchorsNote}
  ${BILINGUAL_BRIDGING_NOTE}
  ${QUIZ_QUALITY_NOTE}

  Respond ONLY with a valid JSON object...
  ```

### Phase 2 — Completion file

- [ ] Write `TICKET_0007_pass2_lesson_quality_batch2_completion.md`

## Files to Be Created / Modified

| File | Action | Purpose |
|---|---|---|
| `src/prompts/pass2.js` | Modify | Add two named constants + interpolate into prompt |
| `docs/TICKET_0007_pass2_lesson_quality_batch2_completion.md` | Create | Completion record |

## Design System Compliance

Not applicable — no UI or CSS changes in this ticket.

## Dependencies and Risks

- Depends on TICKET_0006 being complete (which it is) — `${culturalAnchorsNote}` must already exist in the template as the injection anchor
- Both constants use exact text from the ticket spec — no interpretation required
- Adding ~40 tokens of instruction per prompt call; within the existing 2500 token output budget

## Estimated Scope

- **Files affected:** 1
- **Complexity:** Low
