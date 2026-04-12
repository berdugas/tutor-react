import { callRag } from '../lib/api'

export function useRag() {
  async function fetchCurriculumChunk(topic, subject, gradeNum) {
    if (!topic || !subject) return null

    const result = await callRag(topic, subject, gradeNum)

    if (!result.chunk) {
      console.warn('[AralMate] RAG: no curriculum chunk found for', subject, topic)
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
