import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import styles from './QuizView.module.css'

function getAlonMessage(score, total, studentName) {
  if (score === total) return `Kahanga-hanga, ${studentName}! Lima sa lima — perpekto! Patuloy lang!`
  if (score >= 4)      return `Napakagaling, ${studentName}! Halos perpekto — isa ka talagang matalinong mag-aaral!`
  if (score >= 3)      return `Magaling, ${studentName}! Tatlo ang tama — tingnan natin ang mga hindi pa malinaw.`
  return `Okay lang yan, ${studentName}! Mahirap itong paksa — nandito ako para tulungan ka. Basahin nating muli ang leksyon, sige?`
}

function getRetryAlonMessage(score, total, studentName) {
  if (score === total) return `Perpekto sa ikalawang pagsubok, ${studentName}! Iyan ang tunay na pag-aaral!`
  if (score >= 4)      return `Bumuti ka, ${studentName}! Halos perpekto na — magpatuloy ka lang!`
  if (score >= 3)      return `Magaling, ${studentName}! Unti-unting napabuti. Basahin muli ang leksyon para mas mapalakas pa!`
  return `Huwag sumuko, ${studentName}! Mahirap itong paksa ngunit kaya mo ito. Basahin muli nating mabuti ang leksyon.`
}

export default function QuizView({ onGoToLesson }) {
  const { lessonData, quizAnswered, setQuizAnswered, earnTala, studentName } = useApp()
  const scoreCardRef = useRef(null)

  // Track attempt number locally — UI state only, does not need to be global
  // Attempt 1 = first try (full Tala rewards)
  // Attempt 2 = second try (reduced Tala — 1 per correct only, no completion bonus)
  // Attempt 3+ = no Tala rewards at all
  const [attempt, setAttempt] = useState(1)

  if (!lessonData) return null

  const { quiz } = lessonData
  const totalAnswered = Object.keys(quizAnswered).length
  const allDone = totalAnswered === quiz.length

  function handleAnswer(qIdx, optIdx) {
    if (quizAnswered[qIdx] !== undefined) return
    const correct = quiz[qIdx].correct === optIdx

    // Tala per correct answer: full on attempt 1, reduced on attempt 2, none after
    if (correct) {
      if (attempt === 1) earnTala(5)
      else if (attempt === 2) earnTala(1)
      // attempt 3+: no Tala
    }

    const updated = { ...quizAnswered, [qIdx]: optIdx }
    setQuizAnswered(updated)

    // If this was the last question, scroll to score card
    // Completion bonus: full on attempt 1, none after
    if (Object.keys(updated).length === quiz.length) {
      const score = quiz.filter((q, i) => updated[i] === q.correct).length
      if (attempt === 1) earnTala(score * 3)
      setTimeout(() => {
        scoreCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 100)
    }
  }

  function handleGoToLesson() {
    onGoToLesson()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleRetry() {
    setQuizAnswered({})
    setAttempt(prev => prev + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const score = quiz.filter((q, i) => quizAnswered[i] === q.correct).length
  const isPerfect = allDone && score === quiz.length

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

  // Tala label changes based on attempt to be honest about rewards
  function getTalaLabel(s) {
    if (attempt === 1) return `+${s * 3} bonus Tala earned! ⭐`
    if (attempt === 2) return `+${s} Tala earned ⭐ (retry bonus reduced)`
    return 'No bonus Tala — keep studying! 📖'
  }

  // Show retry button for non-perfect scores
  // After attempt 2, no more retry button — two attempts is the limit
  const showRetry = allDone && !isPerfect && attempt <= 2

  // Show review lesson button for low scores (≤ 2) on any attempt
  const showReviewLesson = allDone && score <= 2 && onGoToLesson

  return (
    <div className={styles.quizSection}>
      {/* Attempt indicator — shown from attempt 2 onwards */}
      {attempt > 1 && (
        <div className={styles.attemptBadge}>
          🔄 Pagsubok #{attempt}
        </div>
      )}

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
                {selected === q.correct ? '✅ Tama! ' : '💛 Almost! '}
                {q.explanation}
              </div>
            )}
          </div>
        )
      })}

      {allDone && (
        <div ref={scoreCardRef} className={styles.quizScore}>
          <div className={styles.alonBubble}>
            <span className={styles.alonBubbleIcon}>🦅</span>
            <span className={styles.alonBubbleText}>
              {attempt === 1
                ? getAlonMessage(score, quiz.length, studentName)
                : getRetryAlonMessage(score, quiz.length, studentName)}
            </span>
          </div>
          <div className={styles.scoreEmoji}>{getScoreEmoji(score, quiz.length)}</div>
          <div className={styles.scoreNum}>{score} / {quiz.length}</div>
          <div className={styles.scoreMsg}>{getScoreMessage(score, quiz.length)}</div>
          <div className={styles.scoreTala}>{getTalaLabel(score)}</div>

          {showReviewLesson && (
            <button className={styles.reviewBtn} onClick={handleGoToLesson}>
              📖 Basahin muli ang leksyon
            </button>
          )}

          {showRetry && (
            <button className={styles.retryBtn} onClick={handleRetry}>
              🔄 Subukan muli
              {attempt >= 2 && <span className={styles.retryNote}> (huling pagkakataon)</span>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
