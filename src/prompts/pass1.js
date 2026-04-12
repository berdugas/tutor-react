export function buildPass1Prompt(studentName, selectedSubject, studentContext) {
  const grade = studentContext?.gradeLevel || 'Grade 4'

  const profileNote = studentContext
    ? `Student grade: ${studentContext.gradeLevel} | Quarter: ${studentContext.schoolQuarter} | School: ${studentContext.schoolType}`
    : 'Student grade: Grade 4 | Quarter: 1 | School: private'

  const historyNote = (studentContext && studentContext.recentTopics.length > 0)
    ? `Student's recent lesson history (last ${studentContext.recentTopics.length} scans):
${studentContext.recentTopics.map((t, i) => `  - ${studentContext.recentSubjects[i]}: ${t}`).join('\n')}
Use this to understand what the student has been studying. If this scan appears
to be on a topic they have studied before, note it in your analysis.`
    : ''

  return `You are an expert in the Philippine DepEd K-12 curriculum, analyzing a photo of school material for ${studentName}, a ${grade} student who struggles with reading speed and Filipino vocabulary.

The student has selected subject: ${selectedSubject}
${profileNote}
${historyNote}

━━━ STEP 1: UNDERSTAND THE PAGE FIRST ━━━

Before filling any field, read the entire page as a whole and form a complete understanding of it.

Imagine you are a librarian who must catalogue this page. Ask yourself:
1. What is this page fundamentally ABOUT — the one concept, story, skill, or topic a student would learn from it?
2. What would a Filipino Grade 4 teacher write as the objective for this page?
3. What would a student search for if they wanted to find this page again?

Use this understanding — not section headers or subdomain labels — to drive your entire analysis.

CRITICAL READING RULES:
- Philippine textbook pages often show bleed-through from the reverse side — faint, reversed, mirrored text. IGNORE it entirely. Only read dark, clearly printed text that reads left to right.
- Section headers like KASANAYANG PANGWIKA, PAGBASA, PAGSASALITA AT PAGSULAT, GRAMATIKA are CATEGORY LABELS — they tell you the skill area but are NEVER the topic. Look past them to the specific exercise title or content below.
- For exercise pages: the topic is the CONCEPT being practiced, not the subject of the example sentences. If students compare "ang alkansiya" (incomplete) vs "Ang alkansiya ay mabigat." (complete), the topic is the grammatical concept of pangungusap vs parirala — not "alkansiya."
- For story pages: the topic is the story title and theme — not the grammar section header above it.
- For vocabulary pages: the topic is the vocabulary domain being studied.
- For two-column exercises (Pangkat A / Pangkat B): both columns are one lesson — extract the concept being compared, not one column's content.
- Grade level: assess from the CONCEPT difficulty, not example sentence vocabulary. Pangungusap vs parirala = Grade 3-4. Pang-uri = Grade 3-4. Pandiwa aspekto = Grade 4-5.

━━━ STEP 2: FILL THE FIELDS FROM YOUR UNDERSTANDING ━━━

Respond ONLY with a valid JSON object. No markdown, no extra text, no explanation outside the JSON.

{
  "image_quality": "good" | "poor" | "unreadable",
  "quality_note": "One sentence if poor or unreadable, max 15 words. Empty string if good.",
  "can_read": true | false,
  "content_type": "narrative_story" | "worksheet" | "vocabulary_list" | "textbook_page" | "notes" | "poem" | "dialogue" | "unknown",
  "content_type_confidence": "high" | "medium" | "low",
  "subject_detected": "Filipino" | "Araling Panlipunan" | "Mathematics" | "Science" | "Mother Tongue" | "unclear",
  "subject_confidence": "high" | "medium" | "low",
  "subject_signals": "List 1-3 specific clues in the image that led to this subject identification. Max 20 words.",
  "grade_level_estimate": "Grade 1-2" | "Grade 3" | "Grade 4" | "Grade 5-6" | "unclear",
  "grade_level_signals": "List 1-2 specific clues based on concept difficulty, not example vocabulary. Max 20 words.",
  "title_detected": "The specific exercise title or story title visible on the page, exactly as written. NOT the section header. Empty string if none.",
  "topic": "The main concept or skill from your Step 1 understanding — what this page is fundamentally about in 4-8 words. Must come from your librarian understanding, NOT from section headers or category labels. Examples: 'Pagkakaiba ng Pangungusap at Parirala', 'Mga Uri ng Pang-uri', 'Kwento ng Pagkakaibigan', 'Kasaysayan ng Watawat ng Pilipinas'.",
  "language_detected": "Filipino" | "English" | "Mixed",
  "competencies_present": ["List the specific learning competencies visible. Use DepEd terminology. Examples: 'pagbasa ng kwento', 'pagkilala ng pangungusap at parirala', 'pang-uri', 'pag-unawa sa binasa'. List up to 4."],
  "key_vocabulary": ["List up to 8 specific Filipino or subject-specific words from the actual visible text that a ${grade} struggling reader would benefit from learning. Must be words actually present in the image. Empty array if none found."],
  "content_summary": "One sentence describing what this page is about, written as if explaining to a teacher. Max 25 words.",
  "focus_area": "The single most important concept for a struggling ${grade} reader to understand from this page. Be specific. Max 20 words.",
  "unclear_parts": "Briefly describe any parts hard to read due to bleed-through or image quality. Max 15 words. Empty string if clear.",
  "content_density": "simple" | "moderate" | "dense"
}`
}
