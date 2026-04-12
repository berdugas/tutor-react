# TICKET_0001 - Supabase Client Setup and Schema

**Created by:** Product Lead
**Date:** 2026-04-12
**Priority:** Critical

## Background

Phase 2 is complete and verified. The app can scan worksheets and generate
lessons, but all student data (name, Tala score) is hardcoded in AppContext
with no persistence. The studentName defaults to 'Estudyante' and tala is
hardcoded to 145. Nothing survives a page refresh.

Phase 3 begins here. TICKET_0001 establishes the Supabase foundation that all
subsequent Phase 3 tickets depend on. Nothing else in Phase 3 can be built
without this ticket completing first.

## Requirements

### Must Have
- [ ] Create `src/lib/supabase.js` -- Supabase client using environment variables
- [ ] Create the three database tables in Supabase via SQL:
      `students`, `lesson_history`, `vocabulary_mastered`
      Note: `rag_documents` already exists and is populated -- do NOT touch it.
- [ ] Add Supabase anonymous auth initialisation -- on first app load, create
      an anonymous session if none exists
- [ ] Expose the Supabase client as a singleton from `src/lib/supabase.js`
- [ ] Create `.env.local` with placeholder comments for the two required
      environment variables (product lead will fill in real values)
- [ ] Verify the client connects without console errors on app load

### Nice to Have
- [ ] Add a simple `checkConnection()` export that pings Supabase and returns
      true/false -- useful for debugging during Phase 3 development

## Technical Context

- **Relevant files:**
  - `src/lib/api.js` -- existing, do not modify
  - `src/lib/constants.js` -- existing, do not modify
  - `src/context/AppContext.jsx` -- existing, do not modify in this ticket
  - `src/lib/supabase.js` -- CREATE this file
  - `.env.local` -- CREATE this file with placeholder values

- **Related tickets:** TICKET_0002 (depends on this)

- **Migration plan reference:** Phase 3

- **Constraints:**
  - Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only -- these are
    the public/anon keys safe for client-side use
  - The service role key is NEVER used in the React app
  - The Supabase client must be a singleton -- import once, use everywhere
  - Do NOT modify AppContext.jsx in this ticket
  - Do NOT create useSession.js in this ticket -- that is TICKET_0003
  - The `rag_documents` table already exists with data -- skip it entirely

## Database Schema

Run this SQL in the Supabase SQL Editor to create the three tables.

### Table: students
```sql
create table if not exists students (
  id             uuid primary key references auth.users(id),
  name           text not null default 'Estudyante',
  grade_level    text not null default 'Grade 4',
  school_quarter integer not null default 1,
  school_type    text not null default 'private',
  weak_subjects  text[] default '{}',
  tala_total     integer not null default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

alter table students enable row level security;

create policy "Students can read and write own row"
  on students for all
  using (auth.uid() = id);
```

### Table: lesson_history
```sql
create table if not exists lesson_history (
  id                 uuid primary key default gen_random_uuid(),
  student_id         uuid references students(id) on delete cascade,
  scanned_at         timestamptz default now(),
  subject            text not null,
  topic              text not null,
  content_type       text,
  grade_detected     text,
  competencies       text[] default '{}',
  vocabulary_learned text[] default '{}',
  quiz_score         integer,
  tala_earned        integer default 0
);

alter table lesson_history enable row level security;

create policy "Students can read and write own lessons"
  on lesson_history for all
  using (auth.uid() = student_id);
```

### Table: vocabulary_mastered
```sql
create table if not exists vocabulary_mastered (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid references students(id) on delete cascade,
  word          text not null,
  subject       text not null,
  first_seen_at timestamptz default now(),
  last_seen_at  timestamptz default now(),
  times_seen    integer default 1,
  quiz_correct  integer default 0,
  quiz_total    integer default 0
);

alter table vocabulary_mastered enable row level security;

create policy "Students can read and write own vocabulary"
  on vocabulary_mastered for all
  using (auth.uid() = student_id);
```

## Acceptance Criteria

- [ ] `src/lib/supabase.js` exists and exports a named `supabase` client
- [ ] `.env.local` exists with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
      as placeholder comments -- product lead fills in real values before running
- [ ] `.env.local` is listed in `.gitignore`
- [ ] All three tables exist in Supabase with RLS enabled and correct policies
- [ ] `rag_documents` table is completely untouched
- [ ] App loads without any Supabase-related console errors
- [ ] An anonymous user appears in Supabase dashboard under
      Authentication > Users after first app load
- [ ] No hardcoded credentials anywhere in source code

## Notes

- `@supabase/supabase-js` is already installed at v2.101.1 -- no npm install needed
- Anonymous auth must be enabled in the Supabase dashboard manually:
  Authentication > Providers > Anonymous -- product lead does this before
  verifying the acceptance criteria
- The `.env.local` file must NOT be committed to Git -- check `.gitignore` and
  add it if missing
- This ticket makes no visible changes to the UI -- verification is via
  browser console and Supabase dashboard only
- Do NOT use the service role key in the React app under any circumstances
