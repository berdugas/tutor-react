import { useState } from 'react'
import styles from './NameScreen.module.css'

export default function NameScreen({ onSave }) {
  const [value, setValue] = useState('')

  const handleSave = () => {
    const name = value.trim()
    if (!name) return
    localStorage.setItem('am_student_name', name)
    onSave(name)
  }

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <div className={styles.alon}>🦅</div>
        <h2>Kamusta! Ako si Alon 🦅</h2>
        <p>What's your name? I want to know who I'm helping!</p>
        <input
          className={styles.input}
          type="text"
          placeholder="Type your name here…"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoComplete="off"
        />
        <button className={styles.btn} onClick={handleSave}>Let's go! →</button>
      </div>
    </div>
  )
}
