// Subject context primers — applied to ALL scans (photo and text mode)
function buildSubjectContext(subject, grade) {
  const gradeNum = parseInt((grade || '').replace('Grade ', '')) || 4

  const contexts = {
    'Filipino': `SUBJECT DOMAIN — Filipino (${grade}, DepEd MATATAG):
Filipino lessons at this level cover these concept areas. Use these as your frame of reference:
- GRAMATIKA (Grammar): pangngalan (noun), pandiwa (verb), pang-uri (adjective), pang-abay (adverb), panghalip (pronoun), pang-ugnay (conjunction), pang-ukol (preposition), bantas (punctuation)
- PANGUNGUSAP AT PARIRALA: pangungusap = a COMPLETE sentence with subject (paksa) + predicate (panaguri) that expresses a complete thought (buong diwa); parirala = a PHRASE, a group of words WITHOUT a complete thought (walang buong diwa) — it lacks either a subject or predicate. Key terms: diwa = meaning/thought, paksa = subject, panaguri = predicate.
- PAGBASA (Reading): kwento (story), talata (paragraph), pangunahing diwa (main idea), detalye (details), sanhi at bunga (cause and effect), pagkakasunud-sunod ng pangyayari (sequence)
- TALASALITAAN (Vocabulary): kahulugan (meaning), magkasingkahulugan (synonyms), magkasalungat (antonyms), mga idyoma (idioms), sawikain (proverbs)
- PAGSULAT (Writing): naratibo, impormatibo, deskriptibo na teksto; kayarian ng pangungusap
When the topic is a grammar term, use its precise Filipino linguistics definition — not a colloquial or general meaning. Always use the exact DepEd terminology for grammar concepts, not everyday conversational equivalents.`,

    'Mathematics': `SUBJECT DOMAIN — Mathematics (${grade}, DepEd MATATAG):
Math lessons at this level cover these concept areas. Use these as your frame of reference:
${gradeNum <= 3 ? `- NUMBER SENSE: place value, addition, subtraction, multiplication, division of whole numbers
- FRACTIONS: basic fractions, equivalent fractions, comparing fractions
- GEOMETRY: basic shapes, lines, angles
- MEASUREMENT: length, mass, capacity, time, money
- DATA: simple charts, pictographs` :
`- NUMBER AND ALGEBRA: multiplication and division of large numbers, fractions, decimals, ratio, proportion
- MEASUREMENT AND GEOMETRY: perimeter, area, volume, angles, 2D and 3D shapes
- DATA AND PROBABILITY: tables, bar graphs, line graphs, simple probability`}
When the topic is a Math term, use its precise mathematical definition with a Filipino real-world example.`,

    'Science': `SUBJECT DOMAIN — Science (${grade}, DepEd MATATAG):
Science lessons at this level cover these concept areas. Use these as your frame of reference:
${gradeNum <= 4 ? `- LIVING THINGS: plants, animals, human body, ecosystems, food chains
- MATERIALS: properties of matter, solids/liquids/gases, mixtures
- FORCE AND MOTION: push and pull, gravity, friction, simple machines
- EARTH AND SPACE: weather, water cycle, rocks and soil, solar system` :
`- LIFE SCIENCE: cell structure, ecosystems, adaptation, reproduction
- PHYSICAL SCIENCE: matter and its changes, energy, electricity, waves
- EARTH SCIENCE: rocks, weather patterns, natural resources, environment`}
When the topic is a Science term, use its precise scientific definition with observable Filipino examples.`,

    'Araling Panlipunan': `SUBJECT DOMAIN — Araling Panlipunan (${grade}, DepEd MATATAG):
AP lessons at this level cover these concept areas. Use these as your frame of reference:
- KASAYSAYAN (History): pre-colonial Philippines, colonization, heroes and heroines, national symbols, significant events
- HEOGRAPIYA (Geography): Philippine regions, provinces, landforms, bodies of water, neighboring countries
- SIBIKA (Civics): government structure, rights and responsibilities, community roles, national identity
- KULTURA (Culture): Filipino customs, traditions, festivals, ethnic groups, cultural heritage
When the topic is an AP concept, anchor it in Philippine history and geography — use local examples and Filipino heroes.`,

    'Makabansa': `SUBJECT DOMAIN — Makabansa (${grade}, DepEd MATATAG):
Makabansa is an integrated subject combining Araling Panlipunan and values education. Lessons cover:
- Philippine identity, love of country, national symbols (flag, anthem, seal)
- Community and family values, pagmamahal sa bayan
- Philippine geography, regions, and cultural diversity
- Filipino heroes and their contributions to the nation
- Rights, responsibilities, and civic participation
When the topic is a Makabansa concept, connect it to Filipino values and national identity.`,

    'English': `SUBJECT DOMAIN — English (${grade}, DepEd MATATAG):
English lessons at this level cover these concept areas. Use these as your frame of reference:
- GRAMMAR: parts of speech (noun, verb, adjective, adverb, pronoun, preposition, conjunction), sentence structure, punctuation
- READING COMPREHENSION: main idea, details, cause and effect, sequence, inference, author's purpose
- VOCABULARY: word meaning, context clues, synonyms, antonyms, figurative language (simile, metaphor, idiom)
- WRITING: narrative, descriptive, expository, persuasive writing; paragraph structure
When the topic is a grammar term, use its precise English linguistics definition with simple examples.`,
  }

  return contexts[subject] || `SUBJECT DOMAIN — ${subject} (${grade}, DepEd MATATAG):
This is a Philippine elementary school subject. Generate the lesson based on the official DepEd MATATAG curriculum for ${grade} students. Use precise definitions and Filipino real-world examples.`
}

// Subject-specific worked example guidance — injected as instructions BEFORE the JSON block
// This avoids putting instructional text inside the JSON template which breaks parsing.
function buildWorkedExampleNote(subject) {
  const notes = {
    'Mathematics':
`WORKED EXAMPLE INSTRUCTIONS (Mathematics):
- problem: Write a specific word problem using everyday Filipino context (sari-sari store, market, school, farm). Must directly test the topic. Use real numbers.
- steps: (1) Identify what is given and what is being asked. (2) Show the computation with actual numbers. (3) State the final answer with the correct unit.
- answer: The exact numerical answer with unit (e.g. "9 mangga").`,

    'Filipino':
`WORKED EXAMPLE INSTRUCTIONS (Filipino):
- problem: Write a complete Filipino sentence (8-12 words) containing the grammatical element being taught. Start with "Suriin ang pangungusap na ito:" then the sentence.
- steps: (1) Basahin ang buong pangungusap — ano ang paksa? (2) Hanapin ang [grammar term] — anong salita ang [diagnostic question for this term]? (3) Tukuyin ang [grammar term] at ipaliwanag kung bakit.
- answer: State which word is the [grammar term] and explain why in simple English.`,

    'Science':
`WORKED EXAMPLE INSTRUCTIONS (Science):
IMPORTANT: Science is an English-medium subject. Write the problem, ALL steps, and the answer in ENGLISH only. Do not use Filipino in the worked example for Science.
- problem: Describe a specific observable situation in the Philippines a Grade 4 student can see in daily life (rain, plants in the garden, cooking, sunlight). Start with "Let us study this situation:" then describe it in 1-2 English sentences.
- steps: Write all steps in English. (1) Observe — what can you see or notice in this situation? (2) Explain — what scientific process or concept is happening here? (3) Conclude — state the scientific principle in one clear English sentence.
- answer: The scientific conclusion in English. Name the concept and explain what it shows in one sentence.`,

    'Araling Panlipunan':
`WORKED EXAMPLE INSTRUCTIONS (Araling Panlipunan):
- problem: Choose a specific Philippine historical event, geographic feature, or civic situation that illustrates the topic. Start with "Pag-aralan natin ang halimbawang ito:" then describe it in 1-2 sentences.
- steps: (1) Konteksto — when/where did this happen or where is this? (2) Pangyayari o Kahalagahan — what happened or why is this significant? (3) Aral o Kinalaman — what does this teach us about the topic?
- answer: The key insight in one sentence that directly reinforces the main topic.`,

    'Makabansa':
`WORKED EXAMPLE INSTRUCTIONS (Makabansa):
- problem: Present a real-life scenario a Filipino Grade 4 student can relate to (at home, school, or community) showing the value or concept. Start with "Basahin ang sitwasyong ito:"
- steps: (1) Ilarawan — what is happening? Who is involved? (2) Suriin — does this show the value being taught? How? (3) Ilapat — what would YOU do? How does this connect to being a good Filipino?
- answer: How this situation demonstrates the lesson concept, ending with encouragement.`,

    'English':
`WORKED EXAMPLE INSTRUCTIONS (English):
- problem: Write a specific English sentence (8-12 words) containing the grammar element being taught. Start with "Analyze this sentence:" then the sentence.
- steps: (1) Read the sentence — identify the subject. (2) Find the [grammar term] — which word [diagnostic question]? (3) Identify the [grammar term] and explain why.
- answer: State which word is the [grammar term] and explain simply.`,
  }

  return notes[subject] || `WORKED EXAMPLE INSTRUCTIONS:
- problem: Create a specific example demonstrating the concept using a Philippine context.
- steps: (1) Observe the example carefully. (2) Apply what you learned. (3) Reach a conclusion.
- answer: State the conclusion clearly in one sentence.`
}

const BILINGUAL_BRIDGING_NOTE = `BILINGUAL BRIDGING RULE — FOR ALL KEY TERMS AND VOCABULARY:
When introducing any difficult or Academic Filipino vocabulary term in the overview, key_points, or key_terms, always explain it using the three-layer bridge — in this exact order:
1. English equivalent (the word the student likely already knows)
2. Casual Tagalog or household equivalent (a familiar everyday form)
3. The Academic Filipino term used naturally in a sample sentence

Example format: "Ang salitang 'magalang' — sa English, ito ay 'respectful.' Sa bahay, sinasabi nating 'may galang.' Sa ating leksyon: 'Magalang si Miguel sa kanyang mga guro.'"

This bridge applies to any term a Grade 4 private school student (who thinks primarily in English) might not immediately recognize. If the term is already common vocabulary (e.g., 'nanay', 'bahay', 'araw'), skip the bridge and use the word directly.

For Mathematics and Science (English-medium subjects): the bridge is reversed — introduce the English term first, then provide a Filipino-context example sentence. Do not translate Math or Science technical terms into Filipino.`

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

export function buildPass2Prompt(check, studentName, selectedSubject, studentContext, curriculumChunk, isTextMode = false) {
  const grade      = studentContext?.gradeLevel   || 'Grade 4'
  const quarter    = studentContext?.schoolQuarter || 1
  const schoolType = studentContext?.schoolType    || 'private'

  const subjectContext       = buildSubjectContext(selectedSubject, grade)
  const workedExampleNote    = buildWorkedExampleNote(selectedSubject)

  const englishOnlySubjects = ['Science', 'Mathematics', 'English']
  const languageNote = englishOnlySubjects.includes(selectedSubject)
    ? 'IMPORTANT: This is an English-medium subject. Write ALL lesson output in English only — overview, steps, key points, key terms, quiz questions, and flashcard backs. EXCEPTION: flashcard fronts must always be the subject-specific term (Filipino term if applicable, English term for Science/Math). Do not mix Filipino into Science or Math explanations.'
    : (!isTextMode && (check.language_detected === 'Filipino' || check.language_detected === 'Mixed')
      ? `IMPORTANT: The material is written in Filipino/Tagalog. Write ALL lesson output in simple English for a Grade 4 student — BUT follow these rules for Filipino subject lessons:
1. ALWAYS introduce the key concept using its Filipino term FIRST, followed by the English meaning in parentheses. Example: "A parirala (phrase) is a group of words without a complete thought." Never use only the English term for Filipino grammar concepts.
2. The lesson title must be BILINGUAL — Filipino term first, then English. Example: "Pangungusap at Parirala: Complete and Incomplete Sentences" or "Pang-uri: Describing Words (Adjectives)".
3. Key terms in the key_terms array must always use the Filipino word as the term field, not the English word.
4. The remember_this mantra must always be written in Filipino.
5. Flashcard fronts must always be the Filipino/Tagalog word — never English.`
      : `IMPORTANT: Write ALL lesson output in simple English for a Grade 4 student — BUT follow these rules for Filipino subject lessons:
1. ALWAYS introduce the key concept using its Filipino term FIRST, followed by the English meaning in parentheses. Example: "A parirala (phrase) is a group of words without a complete thought."
2. The lesson title must be BILINGUAL — Filipino term first, then English.
3. Key terms must use the Filipino word as the term field.
4. The remember_this mantra must always be in Filipino.
5. Flashcard fronts must always be the Filipino/Tagalog word.`)

  const densityNote = check.content_density === 'dense'
    ? `IMPORTANT: This page has a lot of content. Focus ONLY on this core concept: "${check.focus_area}". Do not try to cover everything on the page.`
    : ''

  const handwritingNote = check.unclear_parts
    ? `NOTE: Some parts were hard to read (${check.unclear_parts}). Make your best effort but note uncertain parts in the unclear_content field.`
    : ''

  const vocabNote = (check.key_vocabulary && check.key_vocabulary.length > 0)
    ? `VOCABULARY PRIORITY: The following specific words were extracted from the student's actual material — prioritize these in flashcards and vocabulary exercises: ${check.key_vocabulary.join(', ')}. Feature these words prominently in key_terms. Give each a very simple definition with a short everyday Filipino example sentence.`
    : ''

  const knownWordsNote = (studentContext && studentContext.knownWords.length > 0)
    ? `KNOWN VOCABULARY: ${studentName} already knows these words from previous lessons:
${studentContext.knownWords.join(', ')}.
Do NOT re-teach these words in key_terms or flashcards. You may use them
freely in explanations and examples since ${studentName} already knows them.
Focus key_terms and flashcards on NEW words from this lesson.`
    : ''

  const recentTopicsNote = (studentContext && studentContext.recentTopics.length > 0)
    ? `RECENT LESSONS: ${studentName} has recently studied: ${studentContext.recentTopics.join(', ')}.
Build on this existing knowledge where relevant. Do not re-introduce concepts
already covered unless this lesson directly extends them.`
    : ''

  const curriculumNote = curriculumChunk
    ? `DEPED MATATAG CURRICULUM REFERENCE:
${curriculumChunk}

Use the learning competencies above as the foundation for this lesson ONLY IF they are clearly relevant to the topic "${check.topic}". If the curriculum reference does not directly mention or relate to this topic, ignore it entirely and rely on your own knowledge of the Philippine DepEd curriculum.
- The quiz questions must test the specific competencies listed (if relevant)
- Key terms must align with vocabulary identified in the curriculum (if relevant)
- The lesson overview must address what the curriculum defines as the content standard for this topic
- Do not teach concepts beyond what the curriculum specifies for this level`
    : ''

  const culturalAnchorsNote = `CULTURAL ANCHORS RULE — APPLIES TO ALL CONTENT IN THIS RESPONSE:
All examples, sample sentences, quiz questions, and flashcard example sentences
must use Filipino cultural references. This is non-negotiable.
Preferred references:
- Filipino foods: adobo, kanin, sinigang, lugaw, bibingka, pandesal, puto, taho, halo-halo, bangus, tilapia
- Family terms: Nanay, Tatay, Lolo, Lola, Ate, Kuya, Tita, Tito
- Filipino animals: kalabaw, manok, baboy, bangus, maya, agila, sarimanok
- Philippine places: Mayon, Pinatubo, Luneta, Intramuros, palengke, paaralan, probinsya, dagat, bundok
- Everyday situations: maghapunan, mag-aral, magluto, magtanim, mag-uwi ng pasalubong
- Filipino names: Miguel, Ana, Juan, Maria, Cardo, Nena

NEVER use generic Western examples. Do not write "The big dog ran fast" — write
"Ang malaking kalabaw ay mabilis tumakbo." Do not write "The hot soup" — write
"Ang mainit na sabaw." If the subject is Mathematics or Science, use Filipino
contexts for word problems and examples.`

  const sourceDescription = isTextMode
    ? `${studentName} wants to learn about the ${selectedSubject} topic: "${check.topic}".
This is a Philippine DepEd MATATAG curriculum topic for ${grade} students.
Generate a lesson that teaches "${check.topic}" using its precise DepEd definition as described in the subject domain above.
Do NOT guess or approximate — use the exact meaning as defined in the Philippine school curriculum.`
    : `You are analyzing a ${check.content_type || 'photo'} from ${studentName}'s ${selectedSubject} class about: "${check.topic}".`

  const sourceInstruction = isTextMode
    ? `Generate this lesson from your knowledge of the Philippine DepEd curriculum.
Use the curriculum reference above as your primary guide when available.
Use the subject domain context above to ensure precise, curriculum-accurate definitions.
Make all content appropriate for a ${grade} Filipino student.
Use relatable Filipino examples (food, family, school, places in the Philippines).
Do NOT reference "the image" or "what you can see" — there is no image.`
    : `Make ALL content appropriate for a ${grade} Filipino student. Base EVERYTHING strictly on what you can see in the image.`

  return `You are Alon, a warm and encouraging AI tutor for Filipino Grade 4 students (ages 9-11).
Student profile: ${studentName}, ${grade}, ${schoolType} school Philippines, Quarter ${quarter}.
Known struggles: slow reading speed, limited Filipino vocabulary, reading comprehension difficulties.
Priority subjects: Filipino language and Araling Panlipunan.

${subjectContext}

${sourceDescription}
${languageNote}
${densityNote}
${handwritingNote}
${vocabNote}
${knownWordsNote}
${recentTopicsNote}
${curriculumNote}
${workedExampleNote}
${culturalAnchorsNote}
${BILINGUAL_BRIDGING_NOTE}
${QUIZ_QUALITY_NOTE}

Respond ONLY with a valid JSON object (no markdown, no extra text):

{
  "topic": "${check.topic}",
  "subject": "${check.subject_detected || selectedSubject}",
  "intro": "2-3 friendly, warm sentences addressing ${studentName} by name, telling them what this lesson is about and why it's interesting. Talk directly to them as 'you'. Be exciting and encouraging!",
  "lesson": {
    "hook": "1-2 sentences connecting this topic to something from a Filipino child's everyday life. Reference something Miguel could actually experience — a meal, a family moment, weather, a place, a school situation. Address Miguel directly as 'you'. End with a question or a surprising connection that makes him want to read on. Write in English. Max 40 words.",
    "objective": "One sentence in Filipino starting with 'Sa katapusan ng araling ito,' that tells Miguel exactly what skill or knowledge he will have by the end. Be specific — not 'matututunan mo ang lesson' but 'malalaman mo kung paano ginagamit ang pang-uri sa paglalarawan ng mga bagay sa iyong paligid.' Max 30 words.",
    "title": "Clear lesson title (max 8 words)",
    "overview": "6-8 sentences that FULLY teach the concept — not just define it. Structure it like a real classroom lesson: (1) Define the concept clearly using the precise DepEd definition. (2) Explain HOW to identify or use it with a concrete step-by-step example using everyday Filipino life (food, family, school, places). (3) Give a SECOND example that shows a different application of the same concept. (4) Explain why this concept matters or how it connects to what the student already knows. A student who has never seen this concept before must understand it completely after reading this.",
    "overview_simplified": "The same explanation but even simpler — as if explaining to a 7-year-old. Use very short sentences. Max 3 sentences.",
    "worked_example": {
      "problem": "Follow the WORKED EXAMPLE INSTRUCTIONS above for this subject. Write the actual example here — not a description of what to write.",
      "steps": [
        "Step 1: actual first step content following the instructions above",
        "Step 2: actual second step content",
        "Step 3: actual third step content"
      ],
      "answer": "The actual answer or conclusion following the instructions above."
    },
    "key_points": [
      "First important thing to remember about this topic",
      "Second important thing",
      "Third important thing",
      "Fourth important thing"
    ],
    "key_points_simplified": [
      "Simpler version of point 1",
      "Simpler version of point 2",
      "Simpler version of point 3",
      "Simpler version of point 4"
    ],
    "remember_this": "One golden rule or the most important thing to remember. Short, memorable, like a mantra. For Filipino language material, write this in Filipino.",
    "key_terms": [
      {"term": "Word or concept", "definition": "Super simple definition with a short everyday Filipino example."}
    ]
  },
  "unclear_content": "If any part of the image was unclear or hard to read, briefly mention it here. Empty string if everything was clear.",
  "quiz": [
    {"question": "Question testing the main concept?", "options": ["Option A text","Option B text","Option C text","Option D text"], "correct": 2, "explanation": "Explain why the correct answer is right AND briefly address why the most tempting wrong answer is wrong. Max 35 words."},
    {"question": "Question 2?", "options": ["A","B","C","D"], "correct": 0, "explanation": "Explain why correct AND why the most tempting wrong answer is wrong. Max 35 words."},
    {"question": "Question 3?", "options": ["A","B","C","D"], "correct": 3, "explanation": "Explain why correct AND why the most tempting wrong answer is wrong. Max 35 words."},
    {"question": "Question 4?", "options": ["A","B","C","D"], "correct": 1, "explanation": "Explain why correct AND why the most tempting wrong answer is wrong. Max 35 words."},
    {"question": "Question 5?", "options": ["A","B","C","D"], "correct": 2, "explanation": "Explain why correct AND why the most tempting wrong answer is wrong. Max 35 words."}
  ]
}

IMPORTANT for quiz: Vary the correct answer position across all 5 questions. No position (0,1,2,3) should appear more than twice. Do not follow the example positions above — use your own varied distribution.
${sourceInstruction}`
}
