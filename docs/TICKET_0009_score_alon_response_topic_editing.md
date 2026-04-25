# TICKET_0009 — Score-Based Alon Response + Confirmation Card Topic Editing

**Created by:** Product Lead
**Date:** 2026-04-18
**Priority:** High

---

## Background

This ticket covers two improvements confirmed as real gaps by live testing today:

**Part A — Score-Based Alon Response (QuizView)**
A real student (Marlon) scored 2/5 on the pantig quiz and received the message
"Keep practicing, Marlon! You'll get it next time!" with nothing else. That is the
highest-stakes emotional moment in the entire session — a student who just got 60%
wrong is either about to give up or about to try again. The generic message does
nothing to help. Alon's greatest advantage over a tired parent or busy teacher is
that it never judges and always responds with exactly the right emotional register.
We are not using that advantage at all at quiz end.

Three changes to QuizView:
1. An Alon speech bubble appears ABOVE the score number — dialogue varies by score tier
2. A "Basahin muli ang leksyon" button appears for scores of 2/5 or below
3. Wrong answer feedback changes from "❌ Not quite." to "💛 Almost! " — softer,
   less punishing for a student who got multiple questions wrong

**Part B — Confirmation Card Topic Editing (ConfirmationCard)**
Pass 1B topic extraction improved significantly in TICKET_0008, but will never be
perfect. Activity titles, mixed-content pages, and ambiguous worksheets will
occasionally produce a slightly off topic. Currently Miguel can correct the subject
and grade on the confirmation card — but not the topic, which is the most important
field. The topic flows into RAG retrieval, Pass 2 lesson focus, quiz question
relevance, and key term selection. Giving Miguel a way to edit it before lesson
generation closes the loop entirely.

One change to ConfirmationCard: add a fourth editable row for the topic, using the
same pattern as the existing content type / subject / grade rows but with a text
input instead of option buttons.

---

## Requirements

### Must Have — Part A (QuizView)
- [ ] Add `getAlonMessage(score, total, studentName)` function returning tier-appropriate
      Filipino dialogue for Alon
- [ ] Render Alon speech bubble ABOVE the score number inside the score card
- [ ] Add "Basahin muli ang leksyon" button for scores ≤ 2 out of 5 — clicking it
      switches the active tab back to 'lesson'
- [ ] Change wrong answer feedback prefix from `❌ Not quite.` to `💛 Almost! `
- [ ] Score card layout: Alon bubble → score number → score message → Tala count →
      review button (if applicable)

### Must Have — Part B (ConfirmationCard)
- [ ] Add a fourth editable row for topic — label "PAKSA" (topic in Filipino)
- [ ] Row shows the detected topic from `pendingCheck.topic` as the current value
- [ ] Tapping the row opens a text input (not option buttons — topic is free text)
- [ ] Editing the topic updates `pendingCheck.topic` in AppContext so Pass 2 receives
      the corrected value
- [ ] Edited state shows the ✓ indicator in the row edit button (same as other rows)
- [ ] Empty topic not allowed — if cleared, revert to original detected topic

### Nice to Have
- [ ] Nothing — scope is tightly defined. Do not add other changes.

---

## Technical Context

### Part A — QuizView

**Files to modify:**
- `src/components/QuizView/QuizView.jsx`
- `src/components/QuizView/QuizView.module.css`

**The tab switching problem:**
`activeTab` and `setActiveTab` are local state inside `LessonOutput.jsx`. `QuizView`
is a child of `LessonOutput` but does not currently receive `setActiveTab` as a prop.
To enable the "Basahin muli ang leksyon" button to switch tabs, `setActiveTab` must
be passed down as a prop from `LessonOutput` to `QuizView`.

**Required change in LessonOutput.jsx:**
```jsx
{activeTab === 'quiz' && <QuizView onGoToLesson={() => setActiveTab('lesson')} />}
```

**Required change in QuizView.jsx:**
```jsx
export default function QuizView({ onGoToLesson }) {
```

QuizView calls `onGoToLesson()` when the review button is tapped. If `onGoToLesson`
is not provided (future use), the button simply does not render.

**Alon dialogue by score tier:**

| Score | Tier | Alon says |
|---|---|---|
| 5/5 | Perfect | `"Kahanga-hanga, ${studentName}! Lima sa lima — perpekto! Patuloy lang!"` |
| 4/5 | Strong | `"Napakagaling, ${studentName}! Halos perpekto — isa ka talagang matalinong mag-aaral!"` |
| 3/5 | Passing | `"Magaling, ${studentName}! Tatlo ang tama — tingnan natin ang mga hindi pa malinaw."` |
| 0–2/5 | Struggle | `"Okay lang yan, ${studentName}! Mahirap itong paksa — nandito ako para tulungan ka. Basahin nating muli ang leksyon, sige?"` |

Note: use "tayo" (we/us) in the struggle tier — Alon struggles alongside Miguel,
not above him. This keeps the affective filter low.

**Wrong answer feedback change:**
In the JSX where feedback is rendered, change:
```jsx
{selected === q.correct ? '✅ Correct! ' : '❌ Not quite. '}
```
to:
```jsx
{selected === q.correct ? '✅ Tama! ' : '💛 Almost! '}
```

**New CSS classes needed in QuizView.module.css:**
- `.alonBubble` — Alon speech bubble inside score card. White/translucent background,
  rounded, contains the Alon emoji + dialogue text. Sits between top of score card
  and the score number.
- `.reviewBtn` — "Basahin muli" button. Sits below `.scoreTala`. White text, outlined
  style (not filled — the score card background is already dark blue). Must be
  visually distinct from the score card background.

All colors must use CSS variables only — no hardcoded hex.

---

### Part B — ConfirmationCard

**Files to modify:**
- `src/components/ConfirmationCard/ConfirmationCard.jsx`
- `src/components/ConfirmationCard/ConfirmationCard.module.css`
- `src/context/AppContext.jsx` — verify `setPendingCheck` is available (it already is)

**How to update the topic in AppContext:**
`pendingCheck` is a full object in AppContext. The topic sits at `pendingCheck.topic`.
To update just the topic without replacing the whole object:

```jsx
setPendingCheck(prev => ({ ...prev, topic: newTopicValue }))
```

The dev team must use this pattern — do NOT replace the entire `pendingCheck` object.

**Topic row structure:**
The topic row follows the same visual pattern as the three existing rows but opens
a text input instead of option buttons.

```jsx
{/* Row: Topic */}
<div className={styles.confirmRow}>
  <div className={styles.rowHeader} onClick={() => toggleRow('topic')}>
    <div className={styles.rowInfo}>
      <div className={styles.rowLabel}>PAKSA</div>
      <div className={styles.rowValue}>{currentTopic}</div>
    </div>
    <div className={`${styles.rowEdit} ${editedRows.has('topic') ? styles.edited : ''}`}>
      {editedRows.has('topic') ? '✓' : '✎'}
    </div>
  </div>
  {openRow === 'topic' && (
    <div className={styles.rowTopicEdit}>
      <input
        className={styles.topicInput}
        type="text"
        value={currentTopic}
        onChange={e => handleTopicChange(e.target.value)}
        onBlur={handleTopicBlur}
        placeholder="Halimbawa: Pang-uri, Pantig, Fractions..."
        autoFocus
      />
    </div>
  )}
</div>
```

**Topic state and handlers:**
Use a local `currentTopic` state initialized from `pendingCheck.topic`. On change,
update local state immediately for responsive input. On blur (when user leaves the
input), commit to AppContext if non-empty, or revert to original if empty:

```jsx
const [currentTopic, setCurrentTopic] = useState(pendingCheck?.topic || '')

function handleTopicChange(value) {
  setCurrentTopic(value)
}

function handleTopicBlur() {
  const trimmed = currentTopic.trim()
  if (!trimmed) {
    // Revert to original detected topic
    setCurrentTopic(pendingCheck?.topic || '')
    return
  }
  setPendingCheck(prev => ({ ...prev, topic: trimmed }))
  setEditedRows(prev => new Set([...prev, 'topic']))
  setOpenRow(null)
}
```

**Position of topic row:**
Insert as the FIRST row — before content type, subject, and grade. The topic is the
most important field and should be the first thing the student sees after the header.

**New CSS in ConfirmationCard.module.css:**
- `.rowTopicEdit` — padding wrapper for the text input (matches `.rowOptions` padding)
- `.topicInput` — full-width text input. Style to match the existing option buttons
  visually: same border radius, same font family (Nunito), same font size (0.875rem),
  border using `var(--border)`, background `var(--bg)`. Focus state: border-color
  `var(--sky)`, outline none.

All colors must use CSS variables only — no hardcoded hex.

---

## Files Modified Summary

| File | Change |
|---|---|
| `src/components/QuizView/QuizView.jsx` | Alon bubble, review button, wrong answer prefix change, `onGoToLesson` prop |
| `src/components/QuizView/QuizView.module.css` | `.alonBubble`, `.reviewBtn` new classes |
| `src/components/LessonOutput/LessonOutput.jsx` | Pass `onGoToLesson` prop to QuizView |
| `src/components/ConfirmationCard/ConfirmationCard.jsx` | Topic row with text input |
| `src/components/ConfirmationCard/ConfirmationCard.module.css` | `.rowTopicEdit`, `.topicInput` new classes |

---

## Acceptance Criteria

### Part A — QuizView
- [ ] Score 5/5: score card shows Alon bubble with perfect-tier dialogue in Filipino
- [ ] Score 4/5: score card shows Alon bubble with strong-tier dialogue in Filipino
- [ ] Score 3/5: score card shows Alon bubble with passing-tier dialogue in Filipino
- [ ] Score 0–2/5: score card shows Alon bubble with struggle-tier dialogue using
      "tayo" language + "Basahin muli ang leksyon" button appears below Tala count
- [ ] Tapping "Basahin muli ang leksyon" switches active tab to 'lesson'
- [ ] Wrong answer feedback prefix is `💛 Almost! ` not `❌ Not quite.`
- [ ] Correct answer feedback prefix remains `✅ Tama! `
- [ ] Score card layout order: Alon bubble → emoji → score number → message → Tala → button
- [ ] No hardcoded hex colors in new CSS — CSS variables only
- [ ] App builds without errors (`npm run build` passes)

### Part B — ConfirmationCard
- [ ] Topic row appears as the FIRST row in the confirmation card
- [ ] Topic row shows the detected topic from `pendingCheck.topic` as current value
- [ ] Tapping the topic row opens a text input with the current topic pre-filled
- [ ] Editing and blurring the input commits the new topic to `pendingCheck` in context
- [ ] Committing a new topic shows the ✓ edited indicator on the row
- [ ] Clearing the input and blurring reverts to original detected topic (no empty topics)
- [ ] `pendingCheck` is updated with spread pattern — no full object replacement
- [ ] Pass 2 uses the corrected topic when lesson is generated
- [ ] No hardcoded hex colors — CSS variables only
- [ ] App builds without errors

---

## Notes

- Do not modify `AppContext.jsx` — `setPendingCheck` already exists and works correctly
- Do not modify any prompt files — this ticket is UI only
- Do not modify `useAnalysis.js` — Pass 2 already reads from `pendingCheck.topic`
  via the `confirmedSubject` / `pendingCheck` merge in `runPass2()`, so the topic
  edit flows through automatically without any hook changes
- The Alon bubble inside the score card should reuse the visual language already
  established in the lesson view hook bubble — same emoji, similar speech bubble
  style — so it feels like the same character throughout the session
- Test Part A by answering all 5 quiz questions and checking the score card for
  each tier. To force a specific score, answer questions deliberately wrong.
- Test Part B by scanning a worksheet, observing the detected topic, editing it
  on the confirmation card, generating the lesson, and verifying the lesson title
  reflects the corrected topic.
