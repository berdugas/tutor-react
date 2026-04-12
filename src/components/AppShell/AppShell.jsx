import { useState, useRef, useEffect } from 'react'
import styles from './AppShell.module.css'

export default function AppShell({ studentName, tala, profileLoading, leftChildren, rightChildren, onEditName, showReset, onReset }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef(null)

  function startEdit() {
    setEditValue(studentName)
    setIsEditing(true)
  }

  function confirmEdit() {
    const name = editValue.trim()
    if (name) onEditName(name)
    setIsEditing(false)
  }

  function cancelEdit() {
    setIsEditing(false)
  }

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  return (
    <div className={styles.wrapper}>
      <nav className={styles.nav}>
        <div className={styles.navAlonFace}>🦅</div>
        <div className={styles.navText}>
          <h1>AralMate</h1>
          <p>Ang Kasama Mo sa Pag-aaral</p>
        </div>
        <div className={styles.navRight}>
          {isEditing ? (
            <div className={styles.nameEdit}>
              <input
                ref={inputRef}
                className={styles.nameInput}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmEdit()
                  if (e.key === 'Escape') cancelEdit()
                }}
                maxLength={30}
              />
              <button className={styles.nameConfirm} onClick={confirmEdit} title="Save">✓</button>
              <button className={styles.nameCancel} onClick={cancelEdit} title="Cancel">✕</button>
            </div>
          ) : (
            <div className={styles.nameDisplay}>
              <span className={styles.nameText}>{studentName}</span>
              <button className={styles.nameEditBtn} onClick={startEdit} title="Change name">✏️</button>
            </div>
          )}
          <div className={styles.navBadge}>⭐ {profileLoading ? '…' : tala}</div>
          {showReset && (
            <button className={styles.resetBtn} onClick={onReset} title="Start over">✕ New</button>
          )}
        </div>
      </nav>
      <div className={styles.columns}>
        <div className={styles.colLeft}>{leftChildren}</div>
        <div className={styles.colRight}>{rightChildren}</div>
      </div>
    </div>
  )
}
