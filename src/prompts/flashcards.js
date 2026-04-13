// Dedicated flashcard prompt — runs as a separate call after Pass 2
// This gives Kimi full focused attention on word selection and definition accuracy
// without competing with lesson, quiz, and worked example generation.

export function buildFlashcardPrompt(check, selectedSubject, studentContext, lessonSummary) {
  const grade    = studentContext?.gradeLevel || 'Grade 4'
  const topic    = check.topic || ''
  const subject  = check.subject_detected || selectedSubject

  // Build the word list from Pass 1 key_vocabulary if available
  // These are words actually extracted from the student's material
  const extractedWords = (check.key_vocabulary && check.key_vocabulary.length > 0)
    ? `Words extracted from the student's material: ${check.key_vocabulary.join(', ')}`
    : ''

  return `You are a Filipino elementary school vocabulary expert creating flashcards for a ${grade} student.

The student just completed a lesson on: "${topic}" (subject: ${subject})

Lesson summary for context:
${lessonSummary}

${extractedWords}

Create exactly 8 flashcards for this lesson. Each flashcard must:
- FRONT: one single Filipino or subject-specific word that is CENTRAL to this lesson — a key concept term, grammar term, or important vocabulary word the student must remember
- BACK: a clear, accurate definition using completely different words from the front — never repeat the front word in the back

WORD SELECTION RULES:
- Choose words the student needs to remember from this lesson
- Prioritize concept terms and grammar terms over example sentence words
- Do not use proper nouns (names of people, places, characters)
- Do not use articles, prepositions, or conjunctions as flashcard terms
- Each word must be a single word, never a phrase

DEFINITION RULES:
- The back must NEVER contain the front word
- Define what the word IS — its precise meaning, not a vague description
- Keep definitions short: 5-10 words maximum
- Use simple language a ${grade} student understands

Respond ONLY with a valid JSON array. No markdown, no extra text:

[
  {"front": "word", "back": "precise definition without repeating the front word"},
  {"front": "word", "back": "precise definition without repeating the front word"},
  {"front": "word", "back": "precise definition without repeating the front word"},
  {"front": "word", "back": "precise definition without repeating the front word"},
  {"front": "word", "back": "precise definition without repeating the front word"},
  {"front": "word", "back": "precise definition without repeating the front word"},
  {"front": "word", "back": "precise definition without repeating the front word"},
  {"front": "word", "back": "precise definition without repeating the front word"}
]`
}
