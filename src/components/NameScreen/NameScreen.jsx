import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import styles from './NameScreen.module.css'

const GRADES = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7']
const QUARTERS = [1, 2, 3, 4]

export default function NameScreen({ onSave }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [gradeLevel, setGradeLevel] = useState(null)
  const [schoolQuarter, setSchoolQuarter] = useState(null)
  const [saving, setSaving] = useState(false)

  // Step 1 — Name
  const handleNameNext = () => {
    if (!name.trim()) return
    setStep(2)
  }

  // Step 3 — School type selected: save to Supabase
  const handleSchoolType = async (schoolType) => {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { error } = await supabase.from('students').upsert({
          id: session.user.id,
          name: name.trim(),
          grade_level: gradeLevel,
          school_quarter: schoolQuarter,
          school_type: schoolType,
          tala_total: 0,
          updated_at: new Date().toISOString()
        })
        if (error) console.error('[AralMate] Profile save failed:', error.message)
      }
    } catch (err) {
      console.error('[AralMate] Profile save error:', err.message)
    } finally {
      setSaving(false)
      onSave({ name: name.trim(), gradeLevel, schoolQuarter, schoolType })
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <div className={styles.stepIndicator}>
          {[1, 2, 3].map(n => (
            <div key={n} className={`${styles.dot} ${step === n ? styles.dotActive : ''} ${step > n ? styles.dotDone : ''}`} />
          ))}
        </div>

        <div className={styles.alon}>🦅</div>

        {/* ── Step 1: Name ───────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2>Kamusta! Ako si Alon 🦅</h2>
            <p>What's your name? I want to know who I'm helping!</p>
            <input
              className={styles.input}
              type="text"
              placeholder="Type your name here…"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNameNext()}
              autoComplete="off"
              autoFocus
            />
            <button className={styles.btn} onClick={handleNameNext}>
              Let's go! →
            </button>
          </>
        )}

        {/* ── Step 2: Grade + Quarter ─────────────────────────── */}
        {step === 2 && (
          <>
            <h2>Magaling, {name}! 🎉</h2>
            <p className={styles.question}>Anong baitang ka na?</p>
            <div className={styles.btnGrid}>
              {GRADES.map(g => (
                <button
                  key={g}
                  className={`${styles.optionBtn} ${gradeLevel === g ? styles.optionSelected : ''}`}
                  onClick={() => setGradeLevel(g)}
                >
                  {g}
                </button>
              ))}
            </div>

            <p className={styles.question}>Anong quarter na ngayon?</p>
            <div className={styles.btnRow}>
              {QUARTERS.map(q => (
                <button
                  key={q}
                  className={`${styles.optionBtn} ${schoolQuarter === q ? styles.optionSelected : ''}`}
                  onClick={() => setSchoolQuarter(q)}
                >
                  Q{q}
                </button>
              ))}
            </div>

            <button
              className={styles.btn}
              style={{ marginTop: '1.5rem' }}
              disabled={!gradeLevel || !schoolQuarter}
              onClick={() => setStep(3)}
            >
              Susunod →
            </button>
          </>
        )}

        {/* ── Step 3: School Type ─────────────────────────────── */}
        {step === 3 && (
          <>
            <h2>Halos tapos na! 🙌</h2>
            <p className={styles.question}>Anong klase ng paaralan mo?</p>
            <div className={styles.schoolBtns}>
              <button
                className={styles.schoolBtn}
                disabled={saving}
                onClick={() => handleSchoolType('private')}
              >
                <span className={styles.schoolIcon}>🏫</span>
                <span>Private</span>
              </button>
              <button
                className={styles.schoolBtn}
                disabled={saving}
                onClick={() => handleSchoolType('public')}
              >
                <span className={styles.schoolIcon}>🏛️</span>
                <span>Public</span>
              </button>
            </div>
            {saving && <p className={styles.saving}>Saving your profile…</p>}
          </>
        )}
      </div>
    </div>
  )
}
