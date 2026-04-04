# CLAUDE.md — AralMate Project Operating Manual

> Read this file in full before taking any action on any ticket.
> This is the single source of truth for Claude Code on this project.

---

## 1. Project Overview

**AralMate** ("Ang Kasama Mo sa Pag-aaral") is a Filipino elementary school AI tutoring app for Android tablets. It helps Grade 4 students catch up on language-based subjects by photographing school materials and receiving AI-generated lessons, quizzes, and flashcards.

| | |
|---|---|
| **Target user** | Grade 4 Filipino students (age 9–11), persona: **Miguel** |
| **Parent persona** | **Nanay** |
| **AI tutor character** | **Alon** — a Sarimanok bird (🦅) |
| **Reward currency** | **Tala** (stars ⭐) |
| **Project root** | `D:\projects\tutor-react` |
| **Tickets folder** | `D:\projects\tutor-react\docs\` |
| **Deployed to** | Netlify (`fastidious-trifle-8e650c.netlify.app`) |
| **API proxy** | Cloudflare Worker |
| **AI model** | Kimi K2.5 (Moonshot AI) — vision model via Worker proxy |
| **Database** | Supabase (Postgres, anonymous auth) |

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| State | React Context + useState |
| Styling | CSS Modules + design system tokens |
| Database | Supabase (Postgres) |
| API proxy | Cloudflare Worker |
| Hosting | Netlify |
| Fonts | Nunito, Baloo 2 (Google Fonts) |

---

## 3. Design System — NON-NEGOTIABLE RULES

### 3.1 Color tokens — always use variables, never hardcode hex

All colors must come from `src/styles/tokens.css`. A raw hex value anywhere in any component CSS file is a violation.

```css
/* CORRECT */
color: var(--navy);
background: var(--sky);

/* WRONG — never do this */
color: #1A3260;
background: #3A8FD8;
```

### 3.2 Full color token reference

```
--sky:     #3A8FD8   Primary blue — Alon, interactive elements
--sky-lt:  #6AAFE8   Light blue — hover states, accents
--sky-dk:  #1D6DB5   Dark blue — active states, links
--sun:     #F5A623   Orange/gold — Tala stars, rewards
--sun-lt:  #FFD166   Light gold — streak counts, badges
--leaf:    #3FAD60   Green — correct answers, success states
--leaf-lt: #74CC8A   Light green — success backgrounds
--coral:   #E8635A   Coral/red — wrong answers, alerts
--teal:    #2DBFB0   Teal — accents
--violet:  #7B68EE   Purple — accents
--night:   #0F1F3D   Very dark navy — phone frame backgrounds
--navy:    #1A3260   Dark navy — navigation, headers
--ink:     #1E2D45   Near-black — body text
--muted:   #6B84A8   Muted blue-grey — secondary text, labels
--border:  #CBD8EC   Light border color
--bg:      #EEF5FF   Page background
--card:    #FFFFFF   Card and surface background
```

### 3.3 Typography rules

- **Headings, nav labels, UI labels:** `font-family: 'Baloo 2', cursive`
- **Body text, chat bubbles, inputs, paragraphs:** `font-family: 'Nunito', sans-serif`
- Never use system fonts as primary in any component.

### 3.4 Component styling rules

- Use **CSS Modules** for all component styles — file named `ComponentName.module.css`
- Import as: `import styles from './ComponentName.module.css'`
- Reference in JSX: `className={styles.myClass}`
- Global design tokens from `tokens.css` are available as CSS variables in all modules — no additional import needed.

---

## 4. Folder Structure

```
D:\projects\tutor-react\
├── CLAUDE.md                        ← this file
├── docs\                            ← all tickets live here
├── src\
│   ├── components\
│   │   ├── AppShell\                ← Phase 1 complete
│   │   ├── WelcomePanel\            ← Phase 1 complete
│   │   ├── NameScreen\
│   │   ├── UploadZone\
│   │   │   └── ProcessingState\
│   │   ├── ConfirmationCard\
│   │   ├── LessonView\
│   │   ├── QuizView\
│   │   └── FlashcardView\
│   ├── context\
│   │   ├── AppContext.jsx
│   │   └── StudentContext.jsx
│   ├── hooks\
│   │   ├── useAnalysis.js
│   │   ├── useSession.js
│   │   └── useTala.js
│   ├── prompts\
│   │   ├── pass1.js
│   │   └── pass2.js
│   ├── lib\
│   │   ├── supabase.js
│   │   └── api.js
│   ├── styles\
│   │   └── tokens.css               ← design system — source of truth
│   └── main.jsx
├── worker\
│   └── index.js
├── public\
├── index.html
└── vite.config.js
```

Each component lives in its own folder containing exactly three files:
- `ComponentName.jsx` — the component
- `ComponentName.module.css` — scoped styles using design tokens
- `index.js` — re-export: `export { default } from './ComponentName'`

---

## 5. AI Architecture — Two-Pass System

This is the core of AralMate. Do not modify this flow unless a ticket explicitly instructs it.

### Pass 1 — Image Analysis
- **Input:** Base64 image + selected subject
- **Output:** Structured JSON: `content_type`, `subject`, `topic`, `grade_level`, `key_vocabulary`, `competencies`
- **Model:** Kimi K2.5 via Cloudflare Worker
- **Defined in:** `src/prompts/pass1.js` as a pure function `buildPass1Prompt(studentName, selectedSubject)`

### Confirmation Card
- Shows Pass 1 results in three expandable rows: content type, subject, grade level
- User can correct any row before proceeding to Pass 2
- **Defined in:** `src/components/ConfirmationCard/`

### Pass 2 — Lesson Generation
- **Input:** Confirmed attributes + student profile + recent lesson history
- **Output:** Lesson text, key terms, 5-question quiz, flashcards
- **Model:** Kimi K2.5 via Cloudflare Worker
- **Defined in:** `src/prompts/pass2.js` as a pure function `buildPass2Prompt(check, studentName, selectedSubject)`

### Flashcard Rule — STRICT, NO EXCEPTIONS
- **Front:** Single Tagalog word ONLY — no phrases, no sentences, no English words
- **Back:** English meaning OR simple Filipino definition
- No alternating card direction. This rule is absolute.

---

## 6. State Management

All global state lives in `AppContext.jsx`. Never add bare global `let` variables — all state goes through Context or local `useState`.

Key state fields in AppContext:

```js
{
  studentName: string,
  selectedSubject: string,      // 'Filipino' | 'Araling Panlipunan' | 'Mathematics' | 'Science'
  confirmedSubject: string,
  confirmedContentType: string,
  confirmedGrade: string,
  pendingCheck: object,         // Pass 1 JSON output
  lessonData: object,           // Pass 2 output
  tala: number,
  appPhase: string,             // 'welcome' | 'upload' | 'confirming' | 'processing' | 'lesson'
}
```

---

## 7. Subjects — Four Only

The subject selector has exactly four options. Do not add, rename, or remove any.

| Label | Value |
|---|---|
| Filipino | `Filipino` |
| Araling Panlipunan | `Araling Panlipunan` |
| Mathematics | `Mathematics` |
| Science | `Science` |

---

## 8. Scope Discipline — What Must Not Be Built

These features were deliberately removed from scope. Do not implement them under any circumstances, regardless of how a ticket is worded:

- Chat or conversational interface
- Voice input or voice recording
- Teacher dashboard
- Multiple child profiles per device
- Regional language variants (Cebuano, Ilocano, etc.)

If a ticket appears to request any of the above, flag it in the plan file and do not implement.

---

## 9. Ticket Workflow Protocol

Tickets are the only way work gets assigned. Everything in `docs\` follows a strict lifecycle.

### 9.1 Ticket Lifecycle

```
1. TICKET_XXXX_description.md              [REQUEST]    Product lead creates this
2. TICKET_XXXX_description_plan.md         [PLAN]       Claude Code creates this
3. TICKET_XXXX_description_approved.md     [APPROVED]   Product lead creates this
4. TICKET_XXXX_description_executed.md     [EXECUTED]   Auto-generated by ticket watcher
5. TICKET_XXXX_description_completion.md   [COMPLETION] Claude Code creates this
6. TICKET_XXXX_description_log.md          [LOG]        Auto-generated by ticket watcher
```

### 9.2 State Machine

| Files present | State | Action |
|---|---|---|
| Base ticket only (no `_plan`) | Needs planning | Create plan file |
| Base + `_plan` (no `_approved`) | Awaiting approval | Nothing — product lead's turn |
| Base + `_plan` + `_approved` (no `_executed`) | Ready to execute | Execute code changes |
| Base + `_plan` + `_approved` + `_executed` (no `_completion`) | Needs completion doc | Write completion file |
| All files including `_completion` | Done | Nothing |

### 9.3 Rules

1. Never modify a base ticket or an approved file. These are product lead-owned.
2. Always read the full chain (base → plan → approved) before executing.
3. Respect every comment in the approved file. If it says skip something, skip it. If it asks a question, answer it in the completion file.
4. One ticket at a time. Finish one before starting the next.
5. Always write the completion file, even if execution was partial or had issues.
6. Use exact file naming. Match the base ticket name, append the suffix.
7. Document all deviations from the plan in the completion file with reasoning.
8. If a ticket is ambiguous, write the plan with assumptions clearly stated and flag them for review.
9. Ignore `_log` and `_executed` files when determining ticket state — these are watcher-managed.

---

## 10. File Format Specifications

### Base Ticket (`TICKET_XXXX_description.md`) — created by product lead

```markdown
# TICKET_XXXX — [Short Title]

**Created by:** Product Lead
**Date:** YYYY-MM-DD
**Priority:** Low / Medium / High / Critical

## Background
[Why is this needed? What problem does it solve?]

## Requirements

### Must Have
- [ ] Requirement 1
- [ ] Requirement 2

### Nice to Have
- [ ] Optional requirement

## Technical Context
- **Relevant files:** `path/to/relevant/file`
- **Related tickets:** TICKET_XXXX
- **Constraints:** [Any constraints specific to AralMate]

## Acceptance Criteria
- [ ] Criteria 1 — [How do we know this is done?]
- [ ] Criteria 2

## Notes
[Additional context, references, or warnings]
```

### Plan File (`TICKET_XXXX_description_plan.md`) — created by Claude Code

```markdown
# Plan: TICKET_XXXX — [Short Title]

**Ticket:** TICKET_XXXX_description.md
**Date:** YYYY-MM-DD
**Status:** Awaiting Approval

## Summary
[1–2 sentence summary of what was requested]

## Implementation Plan

### Phase 1: [Phase Name]
- [ ] Task 1 — description
- [ ] Task 2 — description

### Phase 2: [Phase Name]
- [ ] Task 1 — description

## Files to Be Created / Modified

| File | Action | Purpose |
|---|---|---|
| `src/components/Example/Example.jsx` | Create | Description |
| `src/context/AppContext.jsx` | Modify | What changes and why |

## Design System Compliance
[Confirm all colors use CSS variables. List any tokens used.]

## Dependencies and Risks
[Blockers, assumptions, or risks specific to this ticket]

## Estimated Scope
- **Files affected:** X
- **Complexity:** Low / Medium / High
```

### Approved File (`TICKET_XXXX_description_approved.md`) — created by product lead

```markdown
# Approved: TICKET_XXXX — [Short Title]

**Date:** YYYY-MM-DD
**Decision:** Approved / Approved with Comments / Rejected

## Comments

### Scope Changes
- [e.g., "Skip Phase 2 for now"]

### Constraints
- [e.g., "Do not modify AppContext — use local state only"]

### Questions for Claude
- [e.g., "Which token are you using for the card border?"]
```

### Completion File (`TICKET_XXXX_description_completion.md`) — created by Claude Code

```markdown
# Completion: TICKET_XXXX — [Short Title]

**Ticket:** TICKET_XXXX_description.md
**Date:** YYYY-MM-DD
**Status:** Complete / Partial / Failed

## What Was Done
[Summary of work performed]

## Changes Made

| File | Action | Details |
|---|---|---|
| `src/components/Example/Example.jsx` | Created | Description |
| `src/context/AppContext.jsx` | Modified | What changed |

## Design System Compliance Check
- [ ] All colors use `var(--token)` — no hardcoded hex values
- [ ] All components have `.module.css` and `index.js`
- [ ] Flashcard front rule respected (single Tagalog word only, if applicable)
- [ ] No out-of-scope features added

## Deviations from Plan
[Any changes from the approved plan and why. If none: "None — executed as planned."]

## Approval Comments Addressed
[How each comment from the approved file was handled]

## Acceptance Criteria Check
- [x] Criteria 1 — passed
- [ ] Criteria 2 — not yet / failed (reason)

## Notes for Product Lead
[Anything to know before reviewing. Known issues. Recommended next steps.]
```

---

## 11. Verification Before Writing Completion File

Always check these before marking a ticket complete:

- All CSS uses `var(--token)` — no raw hex values anywhere
- Every new component has `ComponentName.jsx`, `ComponentName.module.css`, and `index.js`
- `AppContext.jsx` was updated if new global state was added
- The app renders without console errors
- Flashcard front rule is respected if flashcards were touched
- No out-of-scope features were accidentally added
- The `docs\` folder has no new files except those specified in the ticket
