import { supabase } from '../lib/supabase'

export function useStudentContext() {
  async function fetchContext() {
    try {
      // Wait for a valid session -- anonymous sign-in may still be resolving
      let session = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data } = await supabase.auth.getSession()
        if (data?.session?.user?.id) {
          session = data.session
          break
        }
        // Wait 300ms and retry -- gives signInAnonymously time to resolve
        await new Promise(r => setTimeout(r, 300))
      }

      if (!session) {
        console.warn('[AralMate] fetchContext: no session after retries')
        return null
      }

      const studentId = session.user.id

      const [profileResult, historyResult, vocabResult] = await Promise.all([
        supabase
          .from('students')
          .select('grade_level, school_quarter, school_type')
          .eq('id', studentId)
          .single(),
        supabase
          .from('lesson_history')
          .select('topic, subject')
          .eq('student_id', studentId)
          .order('scanned_at', { ascending: false })
          .limit(5),
        supabase
          .from('vocabulary_mastered')
          .select('word, last_seen_at')
          .eq('student_id', studentId)
          .order('last_seen_at', { ascending: false })
          .limit(50)
      ])

      if (profileResult.error) console.error('[AralMate] fetchContext profile error:', profileResult.error.message)
      if (historyResult.error) console.error('[AralMate] fetchContext history error:', historyResult.error.message)
      if (vocabResult.error)   console.error('[AralMate] fetchContext vocab error:', vocabResult.error.message)

      const student = profileResult.data
      const history = historyResult.data || []
      const vocab   = vocabResult.data   || []

      return {
        gradeLevel:     student?.grade_level    || 'Grade 4',
        schoolQuarter:  student?.school_quarter || 1,
        schoolType:     student?.school_type    || 'private',
        recentTopics:   history.map(h => h.topic),
        recentSubjects: history.map(h => h.subject),
        knownWords:     vocab.map(v => v.word),
      }
    } catch (err) {
      console.error('[AralMate] fetchContext unexpected error:', err.message)
      return null
    }
  }

  return { fetchContext }
}
