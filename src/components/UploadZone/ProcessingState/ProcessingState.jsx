import { useApp } from '../../../context/AppContext'
import styles from './ProcessingState.module.css'

const STEPS = [
  { n: 1, icon: '🔍', label: 'Checking image quality…' },
  { n: 2, icon: '🏷️', label: 'Identifying the lesson topic…' },
  { n: 3, icon: '📖', label: 'Reading the content…' },
  { n: 4, icon: '✍️', label: 'Writing your lesson summary…' },
  { n: 5, icon: '🎮', label: 'Building quiz & flashcards…' },
]

export default function ProcessingState() {
  const { processingStep, processingLabel } = useApp()

  return (
    <div className={styles.processing}>
      <div className={styles.procCard}>
        <div className={styles.procTitle}>🦅 Alon is working…</div>
        <div className={styles.procSteps}>
          {STEPS.map(step => {
            const isDone = processingStep > step.n
            const isActive = processingStep === step.n
            return (
              <div
                key={step.n}
                className={`${styles.procStep} ${isDone ? styles.done : ''} ${isActive ? styles.active : ''}`}
              >
                <div className={styles.procStepDot}>
                  {isDone ? '✓' : step.icon}
                </div>
                <div className={styles.procStepText}>
                  {isActive ? processingLabel || step.label : step.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
