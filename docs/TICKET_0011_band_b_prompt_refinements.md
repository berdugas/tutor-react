# TICKET_0011 - Band B Prompt Refinements (Grades 4–6)

**Created by:** Product Lead
**Date:** 2026-04-25
**Priority:** Medium

## ⚠️ Status: PENDING PROMPT REVIEW
This ticket is written but NOT ready for execution. The product lead will review the current state of `pass2.js` before approving. Do not generate a plan until the approval file is present.

## Background

The full 130-competency mapping across Grades 1–6 (completed April 20, 2026) identified 8 prompt-level gaps in the existing Pass 2 pipeline for Band B students (Grades 4–6). These are cases where the AI generates a lesson that covers the content but misses curriculum-specific teaching opportunities — genre awareness, text structure recognition, inference-level questioning, and culturally sensitive topic handling.

All 8 improvements are prompt-only changes to `pass2.js`. No architecture changes, no new routes, no UI changes, no new dependencies.

Source analysis: GRADE4_PEDAGOGY_MAP.md, GRADE5_PEDAGOGY_MAP.md, GRADE6_PEDAGOGY_MAP.md

## Requirements

### Must Have

- [ ] **1. Filipino genre reference** — Add a named constant (e.g., `FILIPINO_GENRE_NOTE`) that instructs Pass 2 to identify and teach Filipino literary genres when the scanned content is a narrative text. Genres to recognize: alamat (legend — explains origins), pabula (fable — animal characters with moral), parabula (parable — moral lesson through analogy), anekdota (anecdote — short personal narrative). The lesson should name the genre, explain its convention, and connect it to the specific text. Inject into prompt when `subject === 'Filipino'`.

- [ ] **2. Text structure identification** — Add a named constant (e.g., `TEXT_STRUCTURE_NOTE`) that instructs Pass 2 to identify the organizational structure of non-fiction or informational texts: cause-and-effect, comparison/contrast, sequence/chronological, problem-solution, description. The lesson overview should name the structure and help the student recognize its signal words. Applies to Filipino and English subjects.

- [ ] **3. English inference quiz rule** — Add a rule to the quiz generation section that requires at least 1 out of 5 quiz questions to be an inference question (not directly answerable from the text) when `subject === 'English'` and the content is a reading passage. The inference question should ask "why" or "what can you conclude" rather than "what happened."

- [ ] **4. Paragraph-level grammar worked examples** — Modify the worked example instructions so that when the topic is a grammar concept AND `grade_level >= 5`, the worked example operates at paragraph level (3–4 sentences showing the grammar rule in connected context) rather than single-sentence level. The example should highlight how the rule maintains consistency across sentences.

- [ ] **5. Persuasive text analysis block** — Add a named constant (e.g., `PERSUASIVE_TEXT_NOTE`) that instructs Pass 2 to identify persuasive techniques when the scanned content is an editorial, opinion piece, advertisement, or argumentative text. Techniques to surface: emotional appeal, use of evidence/statistics, call to action, loaded language, rhetorical questions. Inject when `grade_level >= 6` and content appears persuasive.

- [ ] **6. Probability vocabulary note** — Add a note to the math subject primer that flags probability vocabulary when the topic involves chance, likelihood, or data/statistics at Grade 6. Key terms: "likely," "unlikely," "certain," "impossible," "equally likely," "chance," "probability." The note should instruct the AI to explicitly contrast the everyday meaning with the precise mathematical meaning.

- [ ] **7. GEMDAS term in math primer** — Add "GEMDAS" (Grouping, Exponents, Multiplication, Division, Addition, Subtraction) to the math subject primer as the Philippine term for order of operations. The AI should use GEMDAS (not PEMDAS or BODMAS) when generating lessons about order of operations. This applies to all math lessons at Grade 5–6 where order of operations is relevant.

- [ ] **8. Sensitive topic guidance** — Add a named constant (e.g., `SENSITIVE_TOPIC_NOTE`) for Araling Panlipunan topics involving Martial Law (1972–1986) and the People Power Revolution (1986). Guidance: present historical facts factually and age-appropriately for 11–12 year olds; acknowledge that different perspectives exist without taking a political position; focus on civic values (freedom, democracy, peaceful protest) rather than partisan framing; avoid graphic descriptions of human rights violations but do not sanitize the period's significance. Inject when `subject === 'Araling Panlipunan'` and `grade_level >= 6`.

### Nice to Have

- [ ] Each new constant should include a brief inline comment explaining when it activates (for future maintainability)

## Technical Context

- **Primary file:** `D:\tutor-react\aralmate\src\prompts\pass2.js`
- **Related files:** None — all changes are within pass2.js
- **Related tickets:** TICKET_0006 (lesson quality batch 1), TICKET_0007 (batch 2), TICKET_0008 (Pass 1B restructure)
- **Constraints:**
  - All new text must be added as named constants (e.g., `const FILIPINO_GENRE_NOTE = ...`), never inline strings
  - Existing prompt constants must not be modified — only add new ones and inject them into the prompt assembly
  - Conditional injection: use the `subject` and `grade_level` variables already available in `buildPass2Prompt()` to decide which notes to include
  - No UI changes
  - No new dependencies
  - No changes to Pass 2 JSON output schema

## Acceptance Criteria

- [ ] All 8 named constants are defined in `pass2.js`
- [ ] Each constant is conditionally injected into the prompt based on subject and/or grade level (not always included)
- [ ] No existing prompt constants are modified or removed
- [ ] No changes to the Pass 2 output JSON schema
- [ ] The prompt still fits within the 4,000 token output budget (the additions are prompt instructions, not output — but verify the input prompt size hasn't grown unreasonably)
- [ ] Code builds without errors (`npm run build`)

## Notes

- The product lead will review the current state of `pass2.js` in a future session before approving this ticket. This review ensures the ticket instructions align with the actual code structure, not assumptions from memory.
- These 8 improvements were identified during the Grade 4–6 pedagogy map reviews (April 20, 2026). Full rationale is documented in the respective GRADE4/5/6_PEDAGOGY_MAP.md files.
- This ticket deliberately avoids any Band A (Grades 1–3) changes. Band A requires a different JSON schema and will be a separate ticket.
- Prompt internal consistency rule (Learning #21): any new instructions added to the prompt must not contradict existing instructions. Read the full prompt before inserting new blocks.
