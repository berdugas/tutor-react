import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import styles from './TalaFlash.module.css'

export default function TalaFlash() {
  const { tala } = useApp()
  const prevTala = useRef(tala)
  const [visible, setVisible] = useState(false)
  const [message, setMessage] = useState('')
  const timerRef = useRef(null)

  useEffect(() => {
    const delta = tala - prevTala.current
    prevTala.current = tala
    if (delta <= 0) return

    setMessage(`+${delta} Tala! ⭐`)
    setVisible(true)

    // Reset timer on each new earn
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setVisible(false), 2000)

    return () => clearTimeout(timerRef.current)
  }, [tala])

  if (!visible) return null

  return (
    <div className={styles.talaFlash}>
      {message}
    </div>
  )
}
