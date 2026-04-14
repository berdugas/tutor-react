// ── Step 1A: Image text extraction ───────────────────────────────────────────
// One focused job: transcribe all readable text from the image.
// No analysis, no topic detection, no vocabulary — just read the page.

export function buildPass1aPrompt() {
  return `You are an expert at reading Philippine elementary school textbook pages.

Your ONLY job is to transcribe all readable text from this image.

READING RULES:
- Read ONLY dark, clearly printed text that reads left to right
- IGNORE all faint, reversed, or mirrored text (bleed-through from reverse side)
- Preserve the structure: titles, table columns, numbered lists, questions
- Include ALL text you can read — headers, labels, table content, questions
- Do NOT analyze, summarize, or interpret — just transcribe

Respond ONLY with a JSON object:
{
  "can_read": true | false,
  "image_quality": "good" | "poor" | "unreadable",
  "quality_note": "One sentence if poor or unreadable. Empty string if good.",
  "extracted_text": "All readable text from the image, preserving structure. Empty string if unreadable."
}`
}

// ── Step 1B: Analysis from extracted text ─────────────────────────────────────
// Input is clean extracted text (not the image).
// Kimi can focus entirely on curriculum understanding and vocabulary selection.

export function buildPass1bPrompt(extractedText, selectedSubject, studentName, studentContext) {
  const grade = studentContext?.gradeLevel || 'Grade 4'

  const profileNote = studentContext
    ? `Student grade: ${studentContext.gradeLevel} | Quarter: ${studentContext.schoolQuarter} | School: ${studentContext.schoolType}`
    : 'Student grade: Grade 4 | Quarter: 1 | School: private'

  const historyNote = (studentContext && studentContext.recentTopics.length > 0)
    ? `Student's recent lesson history (last ${studentContext.recentTopics.length} scans):
${studentContext.recentTopics.map((t, i) => `  - ${studentContext.recentSubjects[i]}: ${t}`).join('\n')}
Use this to understand what the student has been studying.`
    : ''

  return `You are an expert in the Philippine DepEd K-12 curriculum, analyzing
extracted text from a school material page for ${studentName}, a ${grade} student.

The student selected subject: ${selectedSubject}
${profileNote}
${historyNote}

Here is the COMPLETE TEXT extracted from the page:
---
${extractedText}
---

Analyze this text carefully and fill the fields below.

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

VOCABULARY EXTRACTION RULES:
- Extract words that are CENTRAL to what this lesson teaches
- Prioritize grammar terms, subject-specific terms, and key concept words
- Do NOT include proper nouns (names of people: Zarah, Juan, Maria, etc.)
- Do NOT include common particles and articles (ang, ng, mga, si, sina, ay, at)
- Do NOT include words that only appear as example sentence subjects/objects
  unless they are the concept being taught
- The vocabulary list should help a ${grade} student understand this topic

Respond ONLY with a valid JSON object. No markdown, no extra text:

{
  "content_type": "narrative_story" | "worksheet" | "vocabulary_list" | "textbook_page" | "notes" | "poem" | "dialogue" | "unknown",
  "subject_detected": "Filipino" | "Araling Panlipunan" | "Mathematics" | "Science" | "Mother Tongue" | "unclear",
  "subject_confidence": "high" | "medium" | "low",
  "grade_level_estimate": "Grade 1-2" | "Grade 3" | "Grade 4" | "Grade 5-6" | "unclear",
  "grade_level_signals": "1-2 clues from the concept difficulty, not example vocabulary. Max 20 words.",
  "title_detected": "The specific exercise title or story title from the text, exactly as written. NOT the section header. Empty string if none.",
  "topic": "The main concept in 4-8 words from your analysis. Must reflect what the exercise TEACHES. Examples: 'Pagkakaiba ng Pangungusap at Parirala', 'Mga Uri ng Pang-uri', 'Multiplication of Fractions'.",
  "language_detected": "Filipino" | "English" | "Mixed",
  "competencies_present": ["Up to 4 specific learning competencies using DepEd terminology. Examples: 'pagkilala ng pangungusap at parirala', 'pang-uri', 'pag-unawa sa binasa'."],
  "key_vocabulary": ["Up to 8 Filipino or subject-specific words CENTRAL to this lesson's concept. Must follow the vocabulary extraction rules above. No proper nouns. No particles."],
  "content_summary": "One sentence describing what this page teaches, written for a teacher. Max 25 words.",
  "focus_area": "The single most important concept for a struggling ${grade} reader. Be specific. Max 20 words.",
  "content_density": "simple" | "moderate" | "dense"
}`
}
