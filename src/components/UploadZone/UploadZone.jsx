import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAnalysis } from '../../hooks/useAnalysis'
import { preprocessImage } from '../../lib/imagePreprocess'
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
  const { runPass1, runPass1Text } = useAnalysis()

  const cameraRef = useRef(null)
  const galleryRef = useRef(null)
  const [topicText, setTopicText] = useState('')
  const [preprocessing, setPreprocessing] = useState(false)

  const isProcessing = appScreen === 'processing'
  const hasImage = !!currentImageBase64

  async function handleFile(file) {
    if (!file) return
    setImageQualityNote(null)
    setTopicText('')
    setPreprocessing(true)

    const result = await preprocessImage(file, studentName)
    setPreprocessing(false)

    if (result.qualityNote) setImageQualityNote(result.qualityNote)
    if (result.status === 'hard_block') return

    setImageBase64(result.base64)
    setImageType(result.imageType)
  }

  function handleTopicSubmit() {
    const topic = topicText.trim()
    if (!topic || !selectedSubject) return
    runPass1Text(topic)
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

      {/* Divider */}
      <div className={styles.divider}><span>— o kaya —</span></div>

      {/* Text topic input */}
      <div className={`${styles.textMode} ${uploadLocked ? styles.locked : ''}`}>
        <div className={styles.textModeLabel}>📝 I-type ang topic:</div>
        <input
          className={styles.topicInput}
          type="text"
          placeholder="hal. Pang-uri, Kasaysayan ng Pilipinas, Fractions..."
          value={topicText}
          onChange={e => setTopicText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleTopicSubmit()}
          disabled={uploadLocked || isProcessing}
          maxLength={120}
        />
        <button
          className={styles.topicBtn}
          onClick={handleTopicSubmit}
          disabled={uploadLocked || isProcessing || !topicText.trim()}
        >
          {isProcessing ? '⏳ Ginagawa…' : '🦅 Pag-aralan Ito →'}
        </button>
        {uploadLocked && (
          <div className={styles.lockHint}>Select a subject above to unlock</div>
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

      {/* Preprocessing indicator */}
      {preprocessing && (
        <div className={styles.preprocessingNote}>
          <span className={styles.preprocessingDot} />
          Tinitingnan ang larawan…
        </div>
      )}

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
        <div className={`${styles.qualityNote} ${
          imageQualityNote.type === 'error' ? styles.qualityError :
          imageQualityNote.type === 'warn'  ? styles.qualityWarn  :
          styles.qualityInfo
        }`}>
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
