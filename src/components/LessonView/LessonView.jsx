import { useApp } from '../../context/AppContext'
import styles from './LessonView.module.css'

export default function LessonView() {
  const { lessonData, isSimplified } = useApp()

  if (!lessonData) return null

  const { lesson } = lessonData
  const overview = isSimplified ? lesson.overview_simplified : lesson.overview
  const keyPoints = isSimplified ? lesson.key_points_simplified : lesson.key_points

  return (
    <div className={styles.lessonSection}>
      {/* Overview */}
      <div className={styles.lessonCard}>
        <div className={styles.sectionTitle}>📖 What This Lesson Is About</div>
        <div className={styles.lessonTitle}>{lesson.title}</div>
        <p className={styles.overview}>{overview}</p>
      </div>

      {/* Key points */}
      <div className={styles.lessonCard}>
        <div className={styles.sectionTitle}>✅ Key Points to Remember</div>
        <div className={styles.keyPoints}>
          {keyPoints?.map((point, i) => (
            <div key={i} className={styles.keyPoint}>
              <div className={styles.keyPointNum}>{i + 1}</div>
              <div className={styles.keyPointText}>{point}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Worked example */}
      {lesson.worked_example?.problem && (
        <div className={styles.lessonCard}>
          <div className={styles.sectionTitle}>🔍 Let's Work Through It</div>
          <div className={styles.workedProblem}>{lesson.worked_example.problem}</div>
          <div className={styles.workedSteps}>
            {lesson.worked_example.steps?.map((step, i) => (
              <div key={i} className={styles.workedStep}>
                <div className={styles.stepNum}>{i + 1}</div>
                <div className={styles.stepText}>{step}</div>
              </div>
            ))}
          </div>
          {lesson.worked_example.answer && (
            <div className={styles.workedAnswer}>
              <span className={styles.answerLabel}>✅ Answer: </span>
              {lesson.worked_example.answer}
            </div>
          )}
        </div>
      )}

      {/* Remember this */}
      {lesson.remember_this && (
        <div className={styles.rememberBox}>
          <div className={styles.rememberLabel}>⭐ Most Important</div>
          <div className={styles.rememberText}>{lesson.remember_this}</div>
        </div>
      )}

      {/* Key terms */}
      {lesson.key_terms?.length > 0 && (
        <div className={styles.lessonCard}>
          <div className={styles.sectionTitle}>🔤 Key Terms</div>
          <div className={styles.keyTerms}>
            {lesson.key_terms.map((kt, i) => (
              <div key={i} className={styles.keyTerm}>
                <div className={styles.termWord}>{kt.term}</div>
                <div className={styles.termDef}>{kt.definition}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
