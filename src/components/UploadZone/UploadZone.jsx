import { useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useAnalysis } from '../../hooks/useAnalysis'
import styles from './UploadZone.module.css'

const SUBJECTS = [
  { label: 'Filipino', icon: '🇵🇭', value: 'Filipino' },
  { label: 'Araling Panlipunan', icon: '🗺️', value: 'Araling Panlipunan' },
  { label: 'Mathematics', icon: '🔢', value: 'Mathematics' },
  { label: 'Science', icon: '🔬', value: 'Science' },
]

export default function UploadZone() {
  const {
    studentName,
    selectedSubject, setSelectedSubject,
    currentImageBase64, setImageBase64,
    currentImageType, setImageType,
    imageQualityNote, setImageQualityNote,
    appScreen
  } = useApp()
  const { runPass1 } = useAnalysis()

  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  const isProcessing = appScreen === 'processing'
  const hasImage = !!currentImageBase64

  function handleFile(file) {
    if (!file) return
    setImageQualityNote(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      // Extract base64 part
      const base64 = dataUrl.split(',')[1]
      setImageBase64(base64)
      setImageType(file.type || 'image/jpeg')
    }
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImageBase64(null)
    setImageType(null)
    setImageQualityNote(null)
    if (cameraRef.current) cameraRef.current.value = ''
    if (galleryRef.current) galleryRef.current.value = ''
  }

  const uploadLocked = !selectedSubject

  return (
    <div className={styles.zone}>
      {/* Greeting */}
      <div className={styles.greeting}>
        <span className={styles.greetingAlon}>🦅</span>
        <div>
          <div className={styles.greetingName}>Handa na tayo, {studentName}!</div>
          <div className={styles.greetingSub}>Pick a subject and upload your school material.</div>
        </div>
      </div>

      {/* Subject selector */}
      <div className={styles.subjectLabel}>📚 Choose a subject first:</div>
      <div className={styles.subjectBtns}>
        {SUBJECTS.map(s => (
          <button
            key={s.value}
            className={`${styles.subjectBtn} ${selectedSubject === s.value ? styles.selected : ''}`}
            onClick={() => setSelectedSubject(s.value)}
          >
            <span className={styles.subjectIcon}>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Upload buttons */}
      <div className={`${styles.uploadPrompt} ${uploadLocked ? styles.locked : ''}`}>
        <div className={styles.uploadBtns}>
          <button
            className={styles.upBtn}
            onClick={() => cameraRef.current?.click()}
            disabled={uploadLocked || isProcessing}
          >
            📷 Take Photo
          </button>
          <button
            className={styles.upBtn}
            onClick={() => galleryRef.current?.click()}
            disabled={uploadLocked || isProcessing}
          >
            🖼️ Choose from Gallery
          </button>
        </div>
        {uploadLocked && (
          <div className={styles.lockHint}>Select a subject above to unlock upload</div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files[0])}
      />

      {/* Image preview */}
      {hasImage && (
        <div className={styles.previewWrap}>
          <img
            className={styles.preview}
            src={`data:${currentImageType};base64,${currentImageBase64}`}
            alt="Uploaded material"
          />
          <button className={styles.clearBtn} onClick={clearImage}>
            Change photo / ✕
          </button>
        </div>
      )}

      {/* Image quality note */}
      {imageQualityNote && (
        <div className={`${styles.qualityNote} ${imageQualityNote.type === 'error' ? styles.qualityError : styles.qualityWarn}`}>
          {imageQualityNote.message}
        </div>
      )}

      {/* Analyze button */}
      {hasImage && (
        <button
          className={styles.analyzeBtn}
          onClick={runPass1}
          disabled={isProcessing || !selectedSubject}
        >
          {isProcessing ? '⏳ Analyzing…' : '🦅 Let Alon Read This!'}
        </button>
      )}

      {/* Tips */}
      <div className={styles.tips}>
        <div className={styles.tipsTitle}>📸 Tips for a great scan:</div>
        <ul className={styles.tipsList}>
          <li>Make sure the text is clear and well-lit</li>
          <li>Hold the camera steady and flat above the page</li>
          <li>Avoid shadows across the text</li>
          <li>One page at a time works best</li>
        </ul>
      </div>
    </div>
  )
}
