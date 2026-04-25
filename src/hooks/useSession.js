import { supabase } from '../lib/supabase'
import { callCacheLesson } from '../lib/api'

export function useSession() {
  async function saveLesson(lessonData, check, grade) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const studentId = session.user.id

      // Step 1 — Write lesson_history row
      try {
        const { error } = await supabase.from('lesson_history').insert({
          student_id:         studentId,
          subject:            check.subject_detected || '',
          topic:              check.topic || '',
          content_type:       check.content_type || 'unknown',
          grade_detected:     check.grade_level_estimate || '',
          competencies:       check.competency_clues || [],
          vocabulary_learned: lessonData.lesson?.key_terms?.map(t => t.term) || [],
          quiz_score:         null,
          tala_earned:        20
        })
        if (error) console.error('[AralMate] lesson_history insert failed:', error.message)
      } catch (err) {
        console.error('[AralMate] lesson_history error:', err.message)
      }

      // Step 2 — Upsert vocabulary_mastered for each key term
      try {
        const terms = lessonData.lesson?.key_terms || []
        if (terms.length > 0) {
          const vocabRows = terms.map(t => ({
            student_id:   studentId,
            word:         t.term,
            subject:      check.subject_detected || '',
            last_seen_at: new Date().toISOString(),
            times_seen:   1
          }))
          const { error } = await supabase.from('vocabulary_mastered').upsert(vocabRows, {
            onConflict: 'student_id,word',
            ignoreDuplicates: false
          })
          if (error) console.error('[AralMate] vocabulary_mastered upsert failed:', error.message)
        }
      } catch (err) {
        console.error('[AralMate] vocabulary_mastered error:', err.message)
      }

      // Step 3 — Increment tala_total in students table
      try {
        const { data: student, error: fetchErr } = await supabase
          .from('students')
          .select('tala_total')
          .eq('id', studentId)
          .single()
        if (fetchErr) throw fetchErr

        const newTotal = (student?.tala_total || 0) + 20
        const { error: updateErr } = await supabase
          .from('students')
          .update({ tala_total: newTotal, updated_at: new Date().toISOString() })
          .eq('id', studentId)
        if (updateErr) console.error('[AralMate] tala_total update failed:', updateErr.message)
      } catch (err) {
        console.error('[AralMate] tala update error:', err.message)
      }

      // Step 4 — Save to lesson cache (Stage 1: store only, non-blocking)
      // Not awaited — fire-and-forget. Lesson is already on screen by this point.
      callCacheLesson(lessonData, check, grade)

    } catch (err) {
      // Outer catch — session fetch or unexpected failure. Never blocks UI.
      console.error('[AralMate] saveLesson unexpected error:', err.message)
    }
  }

  return { saveLesson }
}
