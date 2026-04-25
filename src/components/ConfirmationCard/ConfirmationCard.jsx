import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAnalysis } from '../../hooks/useAnalysis'
import {
  CONTENT_TYPE_LABELS, CONTENT_TYPE_OPTIONS,
  SUBJECT_OPTIONS, GRADE_OPTIONS, GRADE_LABELS
} from '../../lib/constants'
import styles from './ConfirmationCard.module.css'

export default function ConfirmationCard() {
  const {
    currentImageBase64, currentImageType,
    confirmedContentType, setConfirmedContentType,
    confirmedSubject, setConfirmedSubject,
    confirmedGrade, setConfirmedGrade,
    pendingCheck, setPendingCheck
  } = useApp()
  const { runPass2 } = useAnalysis()

  const [openRow, setOpenRow] = useState(null)
  const [editedRows, setEditedRows] = useState(new Set())
  const [currentTopic, setCurrentTopic] = useState(pendingCheck?.topic || '')

  function toggleRow(row) {
    setOpenRow(prev => prev === row ? null : row)
  }

  function selectContentType(value) {
    setConfirmedContentType(value)
    setEditedRows(prev => new Set([...prev, 'contentType']))
    setOpenRow(null)
  }

  function selectSubject(value) {
    setConfirmedSubject(value)
    setEditedRows(prev => new Set([...prev, 'subject']))
    setOpenRow(null)
  }

  function selectGrade(value) {
    setConfirmedGrade(value)
    setEditedRows(prev => new Set([...prev, 'grade']))
    setOpenRow(null)
  }

  function handleTopicChange(value) {
    setCurrentTopic(value)
  }

  function handleTopicBlur() {
    const trimmed = currentTopic.trim()
    if (!trimmed) {
      setCurrentTopic(pendingCheck?.topic || '')
      return
    }
    setPendingCheck(prev => ({ ...prev, topic: trimmed }))
    setEditedRows(prev => new Set([...prev, 'topic']))
    setOpenRow(null)
  }

  const contentTypeLabel = CONTENT_TYPE_LABELS[confirmedContentType] || confirmedContentType || '❓ Other'
  const subjectLabel = SUBJECT_OPTIONS.find(o => o.value === confirmedSubject)?.label || confirmedSubject || '—'
  const gradeLabel = GRADE_LABELS[confirmedGrade] || confirmedGrade || '—'

  return (
    <div className={styles.confirmArea}>
      <div className={styles.confirmCard}>
        <div className={styles.confirmHeader}>
          <div className={styles.confirmTitle}>🦅 Alon found this</div>
          <div className={styles.confirmSub}>
            {currentTopic ? `"${currentTopic}"` : 'Check the details below'}
          </div>
        </div>

        {/* Thumbnail */}
        {currentImageBase64 && (
          <div className={styles.thumbWrap}>
            <img
              className={styles.thumb}
              src={`data:${currentImageType || 'image/jpeg'};base64,${currentImageBase64}`}
              alt="Uploaded material"
            />
          </div>
        )}

        {/* Row: Topic */}
        <div className={styles.confirmRow}>
          <div className={styles.rowHeader} onClick={() => toggleRow('topic')}>
            <div className={styles.rowInfo}>
              <div className={styles.rowLabel}>PAKSA</div>
              <div className={styles.rowValue}>{currentTopic}</div>
            </div>
            <div className={`${styles.rowEdit} ${editedRows.has('topic') ? styles.edited : ''}`}>
              {editedRows.has('topic') ? '✓' : '✎'}
            </div>
          </div>
          {openRow === 'topic' && (
            <div className={styles.rowTopicEdit}>
              <input
                className={styles.topicInput}
                type="text"
                value={currentTopic}
                onChange={e => handleTopicChange(e.target.value)}
                onBlur={handleTopicBlur}
                placeholder="Halimbawa: Pang-uri, Pantig, Fractions..."
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Row: Content type */}
        <div className={styles.confirmRow}>
          <div className={styles.rowHeader} onClick={() => toggleRow('contentType')}>
            <div className={styles.rowInfo}>
              <div className={styles.rowLabel}>URI NG MATERYAL</div>
              <div className={styles.rowValue}>{contentTypeLabel}</div>
            </div>
            <div className={`${styles.rowEdit} ${editedRows.has('contentType') ? styles.edited : ''}`}>
              {editedRows.has('contentType') ? '✓' : '✎'}
            </div>
          </div>
          {openRow === 'contentType' && (
            <div className={styles.rowOptions}>
              {CONTENT_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.optBtn} ${confirmedContentType === opt.value ? styles.optSelected : ''}`}
                  onClick={() => selectContentType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row: Subject */}
        <div className={styles.confirmRow}>
          <div className={styles.rowHeader} onClick={() => toggleRow('subject')}>
            <div className={styles.rowInfo}>
              <div className={styles.rowLabel}>SUBJECT</div>
              <div className={styles.rowValue}>{subjectLabel}</div>
            </div>
            <div className={`${styles.rowEdit} ${editedRows.has('subject') ? styles.edited : ''}`}>
              {editedRows.has('subject') ? '✓' : '✎'}
            </div>
          </div>
          {openRow === 'subject' && (
            <div className={styles.rowOptions}>
              {SUBJECT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.optBtn} ${confirmedSubject === opt.value ? styles.optSelected : ''}`}
                  onClick={() => selectSubject(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Row: Grade level */}
        <div className={styles.confirmRow}>
          <div className={styles.rowHeader} onClick={() => toggleRow('grade')}>
            <div className={styles.rowInfo}>
              <div className={styles.rowLabel}>GRADE LEVEL</div>
              <div className={styles.rowValue}>{gradeLabel}</div>
            </div>
            <div className={`${styles.rowEdit} ${editedRows.has('grade') ? styles.edited : ''}`}>
              {editedRows.has('grade') ? '✓' : '✎'}
            </div>
          </div>
          {openRow === 'grade' && (
            <div className={styles.rowOptions}>
              {GRADE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`${styles.optBtn} ${confirmedGrade === opt.value ? styles.optSelected : ''}`}
                  onClick={() => selectGrade(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className={styles.confirmBtn} onClick={runPass2}>
          Tama na, ituloy! ✓
        </button>
      </div>
    </div>
  )
}
