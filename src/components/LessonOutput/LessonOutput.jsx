import { useState } from 'react'
import LessonView from '../LessonView/LessonView'
import QuizView from '../QuizView/QuizView'
import FlashcardView from '../FlashcardView/FlashcardView'
import { useApp } from '../../context/AppContext'
import styles from './LessonOutput.module.css'

export default function LessonOutput() {
  const [activeTab, setActiveTab] = useState('lesson')
  const { isSimplified, setIsSimplified, lessonData } = useApp()

  return (
    <div className={styles.output}>
      {/* Alon intro bubble */}
      <div className={styles.alonIntro}>
        <div className={styles.introCard}>
          <div className={styles.introAlon}>🦅</div>
          <div className={styles.introBubble}>
            <div className={styles.introLabel}>🦅 Alon says</div>
            <div className={styles.introText}>{lessonData?.intro}</div>
          </div>
        </div>
      </div>

      {/* Readability note */}
      {lessonData?.unclear_content && (
        <div className={styles.readabilityNote}>
          ⚠️ Alon's note: "{lessonData.unclear_content}" Some parts were a little hard to read. If something seems off, try uploading a clearer photo!
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabsBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'lesson' ? styles.active : ''}`}
          onClick={() => setActiveTab('lesson')}
        >
          📖 Lesson
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'quiz' ? styles.active : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          ❓ Quiz
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'flashcards' ? styles.active : ''}`}
          onClick={() => setActiveTab('flashcards')}
        >
          🃏 Cards
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>
        {activeTab === 'lesson' && <LessonView />}
        {activeTab === 'quiz' && <QuizView onGoToLesson={() => setActiveTab('lesson')} />}
        {activeTab === 'flashcards' && <FlashcardView />}
      </div>

      {/* Simplify bar — lesson tab only */}
      {activeTab === 'lesson' && (
        <div className={styles.simplifyBar}>
          <button
            className={styles.simplifyBtn}
            onClick={() => setIsSimplified(s => !s)}
          >
            {isSimplified ? '📖 Show full lesson' : '✨ Simplify this lesson'}
          </button>
          <div className={`${styles.simplifyBadge} ${isSimplified ? styles.simplified : ''}`}>
            {isSimplified ? 'Simplified mode' : 'Make it easier'}
          </div>
        </div>
      )}
    </div>
  )
}
