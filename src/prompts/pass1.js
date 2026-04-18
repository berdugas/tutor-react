// ── Step 1A: Image text extraction ───────────────────────────────────────────
// One focused job: transcribe all readable text from the image.
// No analysis, no topic detection, no vocabulary — just read the page.

export function buildPass1aPrompt() {
  return `You are an expert at reading Philippine elementary school textbook pages and worksheets.

Your ONLY job is to transcribe all readable text from this image exactly as printed.

READING RULES:
- Transcribe the PRIMARY text — the text that is darkest, clearest, and most intentionally printed
- If faint ghost text appears behind the main text (bleed-through from the reverse side of the page), ignore it — focus only on the dominant, clearly printed text
- Preserve the structure exactly: titles, numbered lists, sections, questions, columns
- Copy words exactly as written — do NOT correct spelling, do NOT paraphrase, do NOT summarize
- Include ALL primary text — headers, definitions, examples, questions, answer blanks
- Do NOT analyze, interpret, or rewrite anything — only transcribe

QUALITY ASSESSMENT:
- "good": text is clear and you can read it confidently
- "poor": text is partially readable but some words are uncertain
- "unreadable": image is too blurry, dark, or distorted to extract meaningful text

Respond ONLY with a valid JSON object, no markdown:
{
  "can_read": true | false,
  "image_quality": "good" | "poor" | "unreadable",
  "quality_note": "One sentence if poor or unreadable. Empty string if good.",
  "extracted_text": "All readable primary text from the image, preserving structure. Empty string if unreadable."
}`
}

// ── Step 1B: Analysis from extracted text ─────────────────────────────────────
// Input is clean extracted text (not the image).
// Kimi can focus entirely on curriculum understanding and vocabulary selection.

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

  const subjectNote = buildPass1bSubjectNote(selectedSubject)

  return `You are an expert in the Philippine DepEd K-12 curriculum, analyzing
extracted text from a school material page for ${studentName}, a ${grade} student.

The student selected subject: ${selectedSubject}
${profileNote}
${historyNote}
${subjectNote}

Here is the COMPLETE TEXT extracted from the page:
---
${extractedText}
---

Analyze this text carefully and fill the fields below.

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
  "key_vocabulary": ["Up to 8 Filipino or subject-specific words CENTRAL to this lesson's concept. Must follow the vocabulary extraction rules above. For AP: proper nouns of heroes, events, and places are valid. No particles."],
  "content_summary": "One sentence describing what this page teaches, written for a teacher. Max 25 words.",
  "focus_area": "The single most important concept for a struggling ${grade} reader. Be specific. Max 20 words.",
  "content_density": "simple" | "moderate" | "dense"
}`
}
