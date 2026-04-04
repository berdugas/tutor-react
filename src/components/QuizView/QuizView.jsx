import { useRef } from 'react'
import { useApp } from '../../context/AppContext'
import styles from './QuizView.module.css'

export default function QuizView() {
  const { lessonData, quizAnswered, setQuizAnswered, earnTala, studentName } = useApp()
  const scoreCardRef = useRef(null)

  if (!lessonData) return null

  const { quiz } = lessonData
  const totalAnswered = Object.keys(quizAnswered).length
  const allDone = totalAnswered === quiz.length

  function handleAnswer(qIdx, optIdx) {
    if (quizAnswered[qIdx] !== undefined) return
    const correct = quiz[qIdx].correct === optIdx
    if (correct) earnTala(5)
    const updated = { ...quizAnswered, [qIdx]: optIdx }
    setQuizAnswered(updated)

    // If this was the last question, scroll to score card and award completion bonus
    if (Object.keys(updated).length === quiz.length) {
      const score = quiz.filter((q, i) => updated[i] === q.correct).length
      earnTala(score * 3)
      setTimeout(() => {
        scoreCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }

  const score = quiz.filter((q, i) => quizAnswered[i] === q.correct).length

  function getScoreEmoji(s, total) {
    const pct = s / total
    if (pct === 1) return '🏆'
    if (pct >= 0.8) return '⭐'
    if (pct >= 0.6) return '👍'
    return '💪'
  }

  function getScoreMessage(s, total) {
    const pct = s / total
    if (pct === 1) return `Perfect score, ${studentName}! You're amazing! 🎉`
    if (pct >= 0.8) return `Great job, ${studentName}! You really know this topic!`
    if (pct >= 0.6) return `Good effort, ${studentName}! Review the ones you missed.`
    return `Keep practicing, ${studentName}! You'll get it next time!`
  }

  return (
    <div className={styles.quizSection}>
      {quiz.map((q, qIdx) => {
        const answered = quizAnswered[qIdx] !== undefined
        const selected = quizAnswered[qIdx]
        return (
          <div key={qIdx} className={styles.quizQ}>
            <div className={styles.qNum}>Question {qIdx + 1}</div>
            <div className={styles.qText}>{q.question}</div>
            <div className={styles.qOptions}>
              {q.options.map((opt, optIdx) => {
                let optClass = styles.quizOpt
                if (answered) {
                  if (optIdx === q.correct) optClass += ` ${styles.correct}`
                  else if (optIdx === selected) optClass += ` ${styles.wrong}`
                  else optClass += ` ${styles.dimmed}`
                }
                return (
                  <button
                    key={optIdx}
                    className={optClass}
                    onClick={() => handleAnswer(qIdx, optIdx)}
                    disabled={answered}
                  >
                    <span className={styles.optLetter}>{String.fromCharCode(65 + optIdx)}</span>
                    <span>{opt}</span>
                  </button>
                )
              })}
            </div>
            {answered && (
              <div className={`${styles.quizFeedback} ${selected === q.correct ? styles.feedbackCorrect : styles.feedbackWrong}`}>
                {selected === q.correct ? '✅ Correct! ' : '❌ Not quite. '}
                {q.explanation}
              </div>
            )}
          </div>
        )
      })}

      {allDone && (
        <div ref={scoreCardRef} className={styles.quizScore}>
          <div className={styles.scoreEmoji}>{getScoreEmoji(score, quiz.length)}</div>
          <div className={styles.scoreNum}>{score} / {quiz.length}</div>
          <div className={styles.scoreMsg}>{getScoreMessage(score, quiz.length)}</div>
          <div className={styles.scoreTala}>+{score * 3} bonus Tala earned! ⭐</div>
        </div>
      )}
    </div>
  )
}
