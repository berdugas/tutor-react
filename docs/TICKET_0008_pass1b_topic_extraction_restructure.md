# TICKET_0008 — Pass 1B Topic Extraction Restructure

**Created by:** Product Lead
**Date:** 2026-04-18
**Priority:** High

---

## Background

Pass 1B is the text analysis step that identifies the topic, subject, vocabulary, and
competencies from the extracted worksheet text. It feeds everything downstream — the
confirmation card, the RAG retrieval query, and ultimately the Pass 2 lesson prompt.
When Pass 1B gets the topic wrong, the entire lesson is built on a wrong foundation.

A real failure was observed and diagnosed today. A worksheet titled "Pagbasa ng mga
Salitang may Tatlo o Higit Pang Pantig" was scanned. Pass 1B extracted the page title
as the topic verbatim, when the actual concept being taught was "pantig" (syllable
counting mechanics). The lesson that followed was unfocused because it tried to teach
"reading multi-syllable words as an activity" rather than "what a pantig is and how to
count them."

Root cause analysis identified five structural problems with the current Pass 1B prompt:

1. **Activity titles vs concept titles** — no rule distinguishes page titles that
   describe an activity ("Pagbasa ng...") from titles that name a concept ("Pang-uri").
   The model used the bold page title as instructed, but that title was an activity
   description, not a concept name.

2. **Filipino-only section header examples** — the exclusion list names only Filipino
   grammar headers (KASANAYANG PANGWIKA, PAGBASA, GRAMATIKA). Math and Science
   worksheets have their own header patterns (SULIRANIN, GAWAIN, ALAMIN NATIN) that
   are not covered, leaving them unguarded.

3. **Proper noun vocabulary rule breaks Araling Panlipunan** — the rule "do not include
   proper nouns" works for Filipino reading comprehension but incorrectly excludes AP
   key vocabulary like Rizal, Bonifacio, Intramuros, which are exactly what should be
   extracted for AP lessons.

4. **Topic examples are Filipino-heavy** — two Filipino grammar examples, one Math
   example, zero Science or AP examples. The model generalizes from examples; a skewed
   example set produces skewed behavior on underrepresented subjects.

5. **Rules-only approach without reasoning** — the current prompt lists rules but does
   not explain the reasoning behind them. LLMs apply rules more reliably when they
   understand the principle, not just the constraint. The rules also cannot anticipate
   every page structure — reasoning generalizes; a rule list does not.

The fix is a restructure of the TOPIC EXTRACTION RULES and VOCABULARY EXTRACTION RULES
sections, plus adding a subject-aware preamble. The JSON output schema does not change.
No other files are touched.

---

## Requirements

### Must Have
- [ ] Replace the TOPIC EXTRACTION RULES block with a reasoning-first approach plus a
      subject-aware example set covering all four subjects
- [ ] Replace the VOCABULARY EXTRACTION RULES block with subject-aware guidance that
      correctly handles AP proper nouns
- [ ] Add an ACTIVITY TITLE DETECTION rule that teaches the model to distinguish page
      titles describing activities from titles naming concepts
- [ ] Add a subject-aware preamble inside `buildPass1bPrompt()` — a small block of
      subject-specific guidance injected before the rules, built using a helper function
      following the same pattern as `buildSubjectContext()` in `pass2.js`
- [ ] All changes inside `src/prompts/pass1.js` only — no other files

### Nice to Have
- [ ] Nothing — scope is tightly defined. Do not add other changes.

---

## Technical Context

- **File to modify:** `src/prompts/pass1.js` — the ONLY file to touch
- **Function to modify:** `buildPass1bPrompt()` — Pass 1A is not touched
- **How it is called** (from `useAnalysis.js`, do not change the call site):
  ```javascript
  const analysisPrompt = buildPass1bPrompt(
    extraction.extracted_text,  // clean text from Pass 1A
    selectedSubject,            // "Filipino" | "Mathematics" | "Science" | "Araling Panlipunan"
    studentName,                // display name string
    studentContext              // { gradeLevel, schoolQuarter, schoolType, recentTopics, ... }
  )
  ```
- **The subject is available** — `selectedSubject` is passed in, so subject-specific
  guidance can be injected conditionally at prompt build time
- **JSON output schema is unchanged** — same fields, same types, same field names
- **Related tickets:** TICKET_0007 (Pass 2 quality batch 2), TICKET_0006 (Pass 2 batch 1)
- **Constraints:** No new JSON fields, no UI changes, no context changes, no new hooks

---

## Exact Specifications

### Change 1 — Add `buildPass1bSubjectNote()` helper function

Add this helper function in `pass1.js` immediately before `buildPass1bPrompt()`.
Follow the exact same pattern as `buildSubjectContext()` in `pass2.js` — named
function, object lookup, default fallback.

```javascript
function buildPass1bSubjectNote(subject) {
  const notes = {
    'Filipino':
`SUBJECT NOTES — Filipino:
Key concept terms to recognize: pangngalan, pandiwa, pang-uri, pang-abay, panghalip,
pangungusap, parirala, pantig, salita, talata, kwento, pangunahing diwa, sawikain, idyoma.
These are CONCEPT NAMES — if any appear in the text, they are strong candidates for topic.
Do NOT extract proper nouns (character names: Juan, Maria, Daniel) as vocabulary.
Do NOT extract common particles: ang, ng, mga, si, sina, ay, at, ng, sa, na.`,

    'Mathematics':
`SUBJECT NOTES — Mathematics:
Key concept terms to recognize: fraction, decimal, multiplication, division, perimeter,
area, volume, ratio, proportion, graph, probability, equation, place value.
Topics are usually in English or a mix (e.g., "Multiplication of Fractions",
"Paghahanap ng Lugar" for area). Extract the mathematical concept, not the exercise type.
Vocabulary should be mathematical terms, not word problem characters or objects.
Common Math section headers to ignore as topics: SULIRANIN, GAWAIN, SAGUTIN, KALKULAHIN,
ALAMIN, TANDAAN — these describe exercise types, not concepts.`,

    'Science':
`SUBJECT NOTES — Science:
Science is an English-medium subject. Topics and vocabulary should be in English.
Key concept areas: living things, ecosystems, matter, force, motion, energy, earth,
water cycle, solar system, food chain, adaptation.
Topics are usually English noun phrases: "The Water Cycle", "Properties of Matter",
"Food Chains and Ecosystems". Do not translate these into Filipino.
Common Science section headers to ignore as topics: ALAMIN NATIN, GAWAIN, SURIIN,
PAGNILAYAN — these describe activities, not concepts.`,

    'Araling Panlipunan':
`SUBJECT NOTES — Araling Panlipunan:
AP covers history, geography, civics, and culture. Topics often involve specific
Philippine people, places, and events.
IMPORTANT: For AP, proper nouns ARE valid vocabulary — Filipino heroes (Rizal, Bonifacio,
Aguinaldo), historical events (Himagsikan, Rebolusyon), and Philippine places
(Intramuros, Mindanao, Cordillera) are exactly the key vocabulary for AP lessons.
Extract these as vocabulary when they are central to the concept being taught.
Topics should name the historical concept, event, or geographic area being studied,
not the exercise type. Example: "Mga Bayani ng Pilipinas", "Heograpiya ng Pilipinas".`,
  }

  return notes[subject] || `SUBJECT NOTES — ${subject}:
Extract the core concept being taught. Topic should name what the student is learning,
not the activity type or exercise format. Vocabulary should be terms central to
understanding the concept, not proper nouns from example sentences.`
}
```

---

### Change 2 — Replace TOPIC EXTRACTION RULES block

Find the current TOPIC EXTRACTION RULES block:

```
TOPIC EXTRACTION RULES:
- The topic is the CONCEPT being taught, not the section header or category label
- Section headers like KASANAYANG PANGWIKA, PAGBASA, GRAMATIKA are category
  labels — NEVER use these as the topic
- For exercise pages: the topic is what the exercise TEACHES. If students compare
  phrases vs sentences, the topic is "Pagkakaiba ng Pangungusap at Parirala"
- For two-column exercises (Pangkat A / Pangkat B): extract the CONCEPT being
  compared across both columns, not just one column's content
- The specific exercise title (bold line below the section header) is usually
  the best source for the topic
- Grade level: assess from CONCEPT difficulty, not example sentence vocabulary
```

Replace it entirely with:

```
TOPIC EXTRACTION — REASONING FIRST:
Ask yourself one question: "What concept would a teacher write on the board for
this lesson?" That is the topic. It is always a noun or noun phrase naming something
students can study, not a description of what to do.

CONCEPT TITLES vs ACTIVITY TITLES — this distinction is critical:
- A CONCEPT TITLE names what is being learned: "Pantig", "Pang-uri", "Fractions",
  "Mga Bayani ng Pilipinas". These are correct topics.
- An ACTIVITY TITLE describes what students do: "Pagbasa ng...", "Suriin ang...",
  "Basahin ang...", "Pagsasanay sa...". These describe the exercise, not the concept.
  When a page title is an activity title, look INSIDE the page — read the definition
  paragraph or the body text to find the concept actually being taught.

HOW TO FIND THE TOPIC:
1. First check: does the body text define or explain a specific term?
   If yes — that term is the topic. The definitional paragraph is more reliable
   than the page title for concept extraction.
   Example: Page title is "Pagbasa ng mga Salitang may Tatlo o Higit Pang Pantig"
   but the body says "ang pantig ay ang bawat bigkas ng bibig sa pagbitiw ng salita"
   → Topic is "Pantig: Pagbibilang ng Pantig sa Salita", NOT the page title.

2. Second check: is there a bold exercise title below a section header that names
   a concept (not an activity)?
   If yes — use that as the topic.
   Example: Section header "GRAMATIKA" → bold title "Mga Uri ng Pang-uri"
   → Topic is "Mga Uri ng Pang-uri".

3. Third check: for two-column exercises (Pangkat A / Pangkat B), extract the
   CONCEPT being compared across both columns, not just one column's content.
   Example: Column A has complete sentences, Column B has incomplete phrases
   → Topic is "Pagkakaiba ng Pangungusap at Parirala".

WHAT TO IGNORE AS TOPIC:
- Section headers that organize the textbook: KASANAYANG PANGWIKA, PAGBASA,
  GRAMATIKA, TALASALITAAN, PAGSULAT (Filipino); SULIRANIN, GAWAIN, KALKULAHIN
  (Math); ALAMIN NATIN, GAWAIN, SURIIN (Science)
- Page titles that start with activity verbs: Pagbasa, Pagsulat, Pagsasanay,
  Pakikinig, Pagkilala, Basahin, Suriin, Sagutin, Pag-aralan
- Story titles from reading comprehension passages (e.g., "Si Daniel at ang
  Kanyang Nanay") — these are the vehicle for learning, not the concept itself

TOPIC FORMAT:
- 4-8 words, noun phrase, names the concept specifically
- Filipino topics: Filipino noun phrase (e.g., "Pantig at Pagbibilang ng Pantig")
- Math/Science topics: English noun phrase (e.g., "Multiplication of Fractions")
- AP topics: Filipino noun phrase naming the historical or geographic concept

GRADE LEVEL: assess from CONCEPT difficulty, not from example sentence vocabulary.
```

---

### Change 3 — Replace VOCABULARY EXTRACTION RULES block

Find the current VOCABULARY EXTRACTION RULES block:

```
VOCABULARY EXTRACTION RULES:
- Extract words that are CENTRAL to what this lesson teaches
- Prioritize grammar terms, subject-specific terms, and key concept words
- Do NOT include proper nouns (names of people: Zarah, Juan, Maria, etc.)
- Do NOT include common particles and articles (ang, ng, mga, si, sina, ay, at)
- Do NOT include words that only appear as example sentence subjects/objects
  unless they are the concept being taught
- The vocabulary list should help a ${grade} student understand this topic
```

Replace it entirely with:

```
VOCABULARY EXTRACTION RULES:
Extract up to 8 words that are CENTRAL to understanding this lesson's concept.
The test: would a student need to know this word to understand the lesson?

ALWAYS include:
- The core concept term itself (e.g., "pantig", "pang-uri", "fraction")
- Subject-specific technical terms that appear in the definition or explanation
- For AP: Filipino heroes, historical events, and Philippine places that are
  central to the topic (e.g., Rizal, Himagsikan, Intramuros) — these ARE
  valid AP vocabulary even though they are proper nouns

NEVER include:
- Common particles and articles: ang, ng, mga, si, sina, ay, at, sa, na, ng
- Character names from reading comprehension stories (Juan, Maria, Daniel,
  Bb. Rose Delgado) unless the story is about that person as a historical figure
- Words that only appear as props in example sentences
  (e.g., "kalabaw" in "Ang malaking kalabaw" is just an example object,
  not a vocabulary word for a lesson about adjectives)
- The word "salita" (word) or "pangungusap" (sentence) when they are used as
  meta-language about language, not as the concept being taught
```

---

### Change 4 — Inject subject note into the prompt

Inside `buildPass1bPrompt()`, add the subject note variable immediately after the
existing `historyNote` variable:

```javascript
const subjectNote = buildPass1bSubjectNote(selectedSubject)
```

Then inject it into the return string immediately after the `${historyNote}` line
and before the extracted text block:

```
${historyNote}
${subjectNote}

Here is the COMPLETE TEXT extracted from the page:
```

---

## Final Structure of buildPass1bPrompt() Return String

After all changes, the prompt sections must appear in this order:

```
1. Role + student profile
2. profileNote
3. historyNote
4. subjectNote          ← NEW
5. Extracted text block
6. TOPIC EXTRACTION — REASONING FIRST   ← REPLACED
7. VOCABULARY EXTRACTION RULES          ← REPLACED
8. JSON output schema
```

---

## What NOT to Change

- Do **not** modify `buildPass1aPrompt()` — Pass 1A is working correctly
- Do **not** change the JSON output schema — same fields, same types, same names
- Do **not** change `useAnalysis.js` — the call site stays exactly as-is
- Do **not** modify `pass2.js`, `flashcards.js`, or any component
- Do **not** add new exported functions — `buildPass1bSubjectNote()` is a private
  helper inside `pass1.js`, not exported

---

## Acceptance Criteria

- [ ] `buildPass1bSubjectNote()` exists as a non-exported helper in `pass1.js`
- [ ] TOPIC EXTRACTION RULES block is fully replaced with the new reasoning-first block
- [ ] VOCABULARY EXTRACTION RULES block is fully replaced with the new subject-aware block
- [ ] `subjectNote` is injected into the prompt between `historyNote` and the extracted text
- [ ] Test scan of "Pagbasa ng mga Salitang may Tatlo o Higit Pang Pantig" worksheet
      produces topic "Pantig" or "Pagbibilang ng Pantig sa Salita" — NOT the page title
- [ ] Test scan of a Filipino grammar worksheet (pang-uri, pangungusap) produces
      the correct concept as topic, not the section header
- [ ] Test scan of a Mathematics worksheet produces an English-language topic name
- [ ] `buildPass1aPrompt()` is unchanged
- [ ] JSON output schema is unchanged — all existing fields still present
- [ ] App builds without errors (`npm run build` passes)

---

## Notes

- This is a prompt restructure, not an expansion. The goal is to replace brittle
  rule-lists with reasoning-based guidance that generalizes to page structures we
  haven't seen yet. Do not simply add new rules on top of the old ones — replace
  the blocks as specified.
- The `buildPass1bSubjectNote()` helper follows the exact pattern of
  `buildSubjectContext()` in `pass2.js` — a function with a subject-keyed object
  and a default fallback. This keeps the codebase consistent.
- Pass 1A extracted text correctly and reliably in testing. Do not touch it.
- After implementing, test with at least three different worksheet types before
  marking complete: (1) a Filipino reading page with an activity title, (2) a
  Filipino grammar exercise with a concept title, (3) a Mathematics worksheet.
  Verify the topic field in the Pass 1B JSON output for each.
