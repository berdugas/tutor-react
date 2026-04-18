# TICKET_0007 — Pass 2 Lesson Quality: Batch 2 (Bilingual Bridging + Quiz Quality)

**Created by:** Product Lead
**Date:** 2026-04-18
**Priority:** High

---

## Background

TICKET_0006 delivered the first wave of Pass 2 lesson quality improvements: hook, objective, cultural anchors rule, and flashcard example sentences. Those were the "quick wins" — minor JSON fields and one prompt instruction block.

This ticket delivers the next wave. Two separate improvements, both affecting `pass2.js` only — no new components, no schema changes, no new API calls.

**Improvement 1 — Synonym/Context Engine (Bilingual Bridging)**
Research finding (R06, RESEARCH_DIGEST Rule Q3 + V4): For English-dominant Filipino students like Miguel, hard Academic Filipino vocabulary must be introduced through a three-layer bridge rather than cold presentation. When a lesson introduces a difficult term, the AI must explain it as:
1. The English equivalent (familiar bridge)
2. The casual Tagalog/household equivalent (relatable)
3. The Academic Filipino term used in a sample sentence (acquisition)

Example of what this looks like in practice:
> "Ang salitang 'magalang' — sa English, ito ay 'respectful.' Sa bahay, sinasabi nating 'may galang.' Sa ating leksyon: 'Magalang si Miguel sa kanyang mga guro.'"

This three-layer bridge is what makes vocabulary actually stick for a student who thinks primarily in English but is learning in Filipino. Currently, Pass 2 introduces key terms with a definition only — no bridge.

**Improvement 2 — Quiz Question Quality**
The current quiz prompt generates 5 questions with no guidance on difficulty spread, no requirement to reference the student's actual scanned material, and single-sided explanations (correct answer only). Three specific improvements:
- **Difficulty spread:** Q1 = easy, Q2–Q4 = medium difficulty, Q5 = challenging. The quiz should end on a stretch question, not an easy one.
- **Material grounding:** At least 2 of the 5 questions must reference specific content from the student's scanned material — a sentence they read, a word from the page, a specific example from the worksheet. This ties the quiz directly to what Miguel studied, making it feel relevant.
- **Wrong answer explanations:** Currently each question has one `explanation` field that shows after answering. The prompt must now instruct the model to write the explanation so it addresses WHY the wrong choices are wrong (not just why the correct answer is correct). The UI field stays the same — just the quality of the explanation improves.

---

## Requirements

### Must Have
- [ ] Add `BILINGUAL_BRIDGING_NOTE` instruction block to `buildPass2Prompt()` in `src/prompts/pass2.js`
- [ ] Add `QUIZ_QUALITY_NOTE` instruction block to `buildPass2Prompt()` in `src/prompts/pass2.js`
- [ ] Both instruction blocks must be named constants (not inlined into the template string) — follow the existing pattern in `pass2.js`
- [ ] Both constants must be interpolated into the prompt string before the JSON block

### Nice to Have
- [ ] Nothing — scope is tightly defined. Do not add other changes.

---

## Technical Context

- **File to modify:** `src/prompts/pass2.js` — this is the ONLY file to touch
- **Related tickets:** TICKET_0006 (previous quality batch — hook, objective, cultural anchors, flashcard examples)
- **Research basis:** RESEARCH_DIGEST Rules Q3, V4, S3 (partial), E3 (partial)
- **Migration plan reference:** Phase 4 — Lesson Quality
- **Constraints:**
  - No hardcoded hex colors — not applicable here (no UI changes)
  - No new components, no new JSON fields in the output schema
  - No changes to `QuizView.jsx`, `LessonView.jsx`, or any other component
  - Do not modify Pass 1 prompts
  - Do not modify the flashcard prompt
  - Follow the existing constant pattern in `pass2.js` — named const → interpolated in template

---

## Exact Specifications

### Change 1 — Bilingual Bridging Instruction Block

Add the following as a named constant in `pass2.js`, immediately before `buildPass2Prompt()`:

```javascript
const BILINGUAL_BRIDGING_NOTE = `BILINGUAL BRIDGING RULE — FOR ALL KEY TERMS AND VOCABULARY:
When introducing any difficult or Academic Filipino vocabulary term in the overview, key_points, or key_terms, always explain it using the three-layer bridge — in this exact order:
1. English equivalent (the word the student likely already knows)
2. Casual Tagalog or household equivalent (a familiar everyday form)
3. The Academic Filipino term used naturally in a sample sentence

Example format: "Ang salitang 'magalang' — sa English, ito ay 'respectful.' Sa bahay, sinasabi nating 'may galang.' Sa ating leksyon: 'Magalang si Miguel sa kanyang mga guro.'"

This bridge applies to any term a Grade 4 private school student (who thinks primarily in English) might not immediately recognize. If the term is already common vocabulary (e.g., 'nanay', 'bahay', 'araw'), skip the bridge and use the word directly.

For Mathematics and Science (English-medium subjects): the bridge is reversed — introduce the English term first, then provide a Filipino-context example sentence. Do not translate Math or Science technical terms into Filipino.`
```

Interpolate `BILINGUAL_BRIDGING_NOTE` into the final prompt string, immediately **after** `${culturalAnchorsNote}` and immediately **before** `Respond ONLY with a valid JSON object`.

---

### Change 2 — Quiz Quality Instruction Block

Add the following as a named constant in `pass2.js`, immediately after `BILINGUAL_BRIDGING_NOTE`:

```javascript
const QUIZ_QUALITY_NOTE = `QUIZ QUALITY RULES — APPLY TO ALL 5 QUESTIONS:

DIFFICULTY SPREAD (required):
- Question 1: Easy — tests direct recall of the main concept. A student who read the lesson should get this right.
- Questions 2, 3, 4: Medium — tests understanding and application. Requires thinking, not just recall.
- Question 5: Challenging — tests deeper understanding or application in a new context. A student must truly understand the concept, not just memorize it.

MATERIAL GROUNDING (required — at least 2 of 5 questions):
At least 2 questions must reference specific content from the student's actual material — a specific word, sentence, or example that appeared on the scanned page or that was identified in the topic. This makes the quiz feel directly relevant to what the student just studied, not generic.
If in text-input mode (no scanned material), at least 2 questions must use the specific examples from the lesson overview you just generated.

WRONG ANSWER EXPLANATIONS (required — all 5 questions):
The explanation field must not only say why the correct answer is right — it must also briefly address why the most tempting wrong answer is wrong. Students learn more from understanding their mistakes than from simply being told the right answer.
Example: "Tama! Ang 'malaki' ay pang-uri — naglalarawan ito ng pangngalan. Ang 'tumakbo' ay pandiwa, hindi pang-uri."

DISTRACTOR QUALITY (required):
Wrong answer choices must be plausible — they should be answers a student who partially understands the topic might genuinely choose. Never use obviously wrong or nonsensical distractors. The wrong answers should represent common misconceptions or related-but-incorrect concepts.`
```

Interpolate `QUIZ_QUALITY_NOTE` into the final prompt string, immediately **after** `${BILINGUAL_BRIDGING_NOTE}` (which itself is after `${culturalAnchorsNote}`).

The sequence of instruction blocks before the JSON template must be:
```
${culturalAnchorsNote}
${BILINGUAL_BRIDGING_NOTE}
${QUIZ_QUALITY_NOTE}

Respond ONLY with a valid JSON object...
```

---

## What NOT to Change

- Do **not** modify the JSON output schema — no new fields
- Do **not** modify `QuizView.jsx` — the UI renders `q.explanation` already; the improvement is prompt-level only
- Do **not** modify `LessonView.jsx`, `FlashcardView.jsx`, or any other component
- Do **not** modify `pass1.js` or `flashcards.js`
- Do **not** add new routes, hooks, or context changes
- Do **not** clean up console.log statements — leave debug logs as-is

---

## Acceptance Criteria

- [ ] `BILINGUAL_BRIDGING_NOTE` exists as a named constant in `pass2.js` (not inlined)
- [ ] `QUIZ_QUALITY_NOTE` exists as a named constant in `pass2.js` (not inlined)
- [ ] Both constants are interpolated into the prompt string in the correct position: after `culturalAnchorsNote`, before the JSON block
- [ ] A test scan of a Filipino grammar worksheet produces an overview where at least one key term uses the three-layer bridge format (English → casual Tagalog → Academic Filipino in sentence)
- [ ] A test scan produces a quiz where Q1 is noticeably easier than Q5
- [ ] A test scan produces a quiz where at least 2 questions reference specific words or content from the scanned material
- [ ] A test scan produces quiz explanations that address why the wrong answer is wrong, not only why the correct answer is right
- [ ] No other files are modified
- [ ] App builds without errors (`npm run build` passes)

---

## Notes

- The only file touched in this ticket is `src/prompts/pass2.js`.
- Both additions follow the existing pattern already established in `pass2.js` where instruction sections are built as named constants (`culturalAnchorsNote`, `workedExampleNote`, `languageNote`, etc.) and interpolated into the template. The dev team must follow this pattern — do not break the pattern by inlining.
- The `QUIZ_QUALITY_NOTE` instruction does not change the JSON structure of the quiz array. Each question still has `question`, `options`, `correct`, and `explanation` fields. The improvement is in the *content* of those fields, not the structure.
- After implementing, test with at least two scan types: (1) a Filipino grammar worksheet, (2) a Mathematics word problem worksheet. Verify both improvements are visible in the raw JSON output before marking complete.
