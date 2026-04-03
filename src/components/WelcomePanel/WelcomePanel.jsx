import styles from './WelcomePanel.module.css'

export default function WelcomePanel({ studentName, visible }) {
  if (!visible) return null
  return (
    <div className={styles.panel}>
      <div className={`${styles.bgCircle} ${styles.bgCircle1}`} />
      <div className={`${styles.bgCircle} ${styles.bgCircle2}`} />
      <div className={styles.cam}>📷</div>
      <div className={styles.book}>📖</div>
      <div className={styles.alonWrap}>
        <span className={styles.alonEmoji}>🦅</span>
        <div className={styles.alonShadow} />
      </div>
      <h2 className={styles.headline}>Handa na ako, <span>{studentName}</span>!</h2>
      <p className={styles.sub}>Ipakita mo ang iyong lesson at gagawa tayo ng quiz at flashcards!</p>
      <div className={styles.steps}>
        <div className={styles.step}>
          <div className={styles.stepNum}>1</div>
          <div className={styles.stepText}>Pumili ng subject mo sa kaliwa</div>
        </div>
        <div className={styles.step}>
          <div className={styles.stepNum}>2</div>
          <div className={styles.stepText}>Mag-upload o kumuha ng litrato ng lesson</div>
        </div>
        <div className={styles.step}>
          <div className={styles.stepNum}>3</div>
          <div className={styles.stepText}>Hayaan si Alon gumawa ng lahat!</div>
        </div>
      </div>
      <div className={styles.arrowHint}>
        <svg width="48" height="16" viewBox="0 0 48 16" fill="none">
          <path d="M44 8 L4 8 M4 8 L12 3 M4 8 L12 13" stroke="#3A8FD8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className={styles.arrowLabel}>Magsimula sa kaliwa</span>
      </div>
    </div>
  )
}
