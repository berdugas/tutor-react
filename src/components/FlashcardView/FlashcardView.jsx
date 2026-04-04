import { useApp } from '../../context/AppContext'
import styles from './FlashcardView.module.css'

export default function FlashcardView() {
  const {
    lessonData,
    currentCardIndex, setCardIndex,
    cardFlipped, setCardFlipped,
    earnTala
  } = useApp()

  if (!lessonData) return null

  const { flashcards } = lessonData
  const total = flashcards.length
  const card = flashcards[currentCardIndex]
  const progress = ((currentCardIndex + 1) / total) * 100

  function flipCard() {
    setCardFlipped(f => !f)
  }

  function prevCard() {
    setCardFlipped(false)
    setCardIndex(i => i - 1)
  }

  function nextCard() {
    setCardFlipped(false)
    setCardIndex(i => i + 1)
    earnTala(2)
  }

  return (
    <div className={styles.flashcardSection}>
      {/* Progress bar */}
      <div className={styles.fcProgress}>
        <div className={styles.fcProgressBar} style={{ width: `${progress}%` }} />
      </div>
      <div className={styles.fcProgressLabel}>
        Card {currentCardIndex + 1} of {total}
      </div>

      {/* Card */}
      <div
        className={`${styles.flashcardWrap} ${cardFlipped ? styles.flipped : ''}`}
        onClick={flipCard}
      >
        <div className={styles.flashcard}>
          <div className={styles.cardFace}>
            <div className={styles.cardLabel}>TERM</div>
            <div className={styles.cardFront}>{card.front}</div>
            <div className={styles.cardHint}>Tap to reveal</div>
          </div>
          <div className={`${styles.cardFace} ${styles.cardBack}`}>
            <div className={styles.cardLabel}>DEFINITION</div>
            <div className={styles.cardBackText}>{card.back}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className={styles.cardNav}>
        <button
          className={styles.navBtn}
          onClick={prevCard}
          disabled={currentCardIndex === 0}
        >
          ← Prev
        </button>
        <button
          className={styles.flipBtn}
          onClick={flipCard}
        >
          {cardFlipped ? '🔄 See Term' : '🔄 Flip'}
        </button>
        <button
          className={styles.navBtn}
          onClick={nextCard}
          disabled={currentCardIndex === total - 1}
        >
          Next →
        </button>
      </div>
    </div>
  )
}
