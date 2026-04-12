import { callRag } from '../lib/api'

// Minimum similarity thresholds by input mode
// Text mode needs a higher threshold because single-word queries
// are more likely to produce false positive matches
const THRESHOLD_PHOTO = 0.38
const THRESHOLD_TEXT  = 0.44

export function useRag() {
  async function fetchCurriculumChunk(topic, subject, gradeNum, isTextMode = false) {
    if (!topic || !subject) return null

    const result = await callRag(topic, subject, gradeNum)

    if (!result.chunk) {
      console.warn('[AralMate] RAG: no curriculum chunk found for', subject, topic)
      return null
    }

    // Apply mode-specific similarity threshold
    const threshold = isTextMode ? THRESHOLD_TEXT : THRESHOLD_PHOTO
    if (result.similarity < threshold) {
      console.warn(
        `[AralMate] RAG: match rejected (similarity ${result.similarity} < threshold ${threshold})`,
        `for "${topic}" — chunk was ${result.subject} ${result.grade} ${result.quarter}`
      )
      return null
    }

    console.log(
      `[AralMate] RAG: matched ${result.subject} ${result.grade} ${result.quarter}`,
      `(similarity: ${result.similarity})`
    )

    return result.chunk
  }

  return { fetchCurriculumChunk }
}
