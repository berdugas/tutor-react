import { createContext, useContext, useState } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [studentName, setStudentName]                       = useState('Estudyante')
  const [tala, setTala]                                     = useState(0)
  const [selectedSubject, setSelectedSubject]               = useState(null)
  const [currentImageBase64, setImageBase64]                = useState(null)
  const [currentImageType, setImageType]                    = useState(null)
  const [lessonData, setLessonData]                         = useState(null)
  const [flashcards, setFlashcards]                         = useState([])
  const [flashcardsLoading, setFlashcardsLoading]           = useState(false)
  const [isSimplified, setIsSimplified]                     = useState(false)
  const [currentCardIndex, setCardIndex]                    = useState(0)
  const [cardFlipped, setCardFlipped]                       = useState(false)
  const [quizAnswered, setQuizAnswered]                     = useState({})
  const [pendingCheck, setPendingCheck]                     = useState(null)
  const [confirmedContentType, setConfirmedContentType]     = useState(null)
  const [confirmedSubject, setConfirmedSubject]             = useState(null)
  const [confirmedGrade, setConfirmedGrade]                 = useState(null)
  const [gradeLevel, setGradeLevel]                         = useState('Grade 4')
  const [schoolQuarter, setSchoolQuarter]                   = useState(1)
  const [appScreen, setAppScreen]                           = useState('name')
  const [processingStep, setProcessingStep]                 = useState(1)
  const [processingLabel, setProcessingLabel]               = useState('')
  const [imageQualityNote, setImageQualityNote]             = useState(null)
  const [profileLoading, setProfileLoading]                 = useState(true)

  const earnTala = (n) => setTala(prev => prev + n)

  // Always reset lesson UI state when new lesson data arrives
  const setLessonDataAndReset = (data) => {
    setCardIndex(0)
    setCardFlipped(false)
    setQuizAnswered({})
    setIsSimplified(false)
    setFlashcards([])          // clear old flashcards
    setFlashcardsLoading(true) // new lesson incoming, cards will load
    setLessonData(data)
  }

  const resetApp = () => {
    setSelectedSubject(null)
    setImageBase64(null)
    setImageType(null)
    setLessonData(null)
    setIsSimplified(false)
    setCardIndex(0)
    setCardFlipped(false)
    setQuizAnswered({})
    setPendingCheck(null)
    setConfirmedContentType(null)
    setConfirmedSubject(null)
    setConfirmedGrade(null)
    setImageQualityNote(null)
    setAppScreen('upload')
  }

  return (
    <AppContext.Provider value={{
      studentName, setStudentName,
      tala, setTala, earnTala,
      selectedSubject, setSelectedSubject,
      currentImageBase64, setImageBase64,
      currentImageType, setImageType,
      lessonData, setLessonData, setLessonDataAndReset,
      flashcards, setFlashcards,
      flashcardsLoading, setFlashcardsLoading,
      isSimplified, setIsSimplified,
      currentCardIndex, setCardIndex,
      cardFlipped, setCardFlipped,
      quizAnswered, setQuizAnswered,
      pendingCheck, setPendingCheck,
      confirmedContentType, setConfirmedContentType,
      confirmedSubject, setConfirmedSubject,
      confirmedGrade, setConfirmedGrade,
      gradeLevel, setGradeLevel,
      schoolQuarter, setSchoolQuarter,
      appScreen, setAppScreen,
      processingStep, setProcessingStep,
      processingLabel, setProcessingLabel,
      imageQualityNote, setImageQualityNote,
      profileLoading, setProfileLoading,
      resetApp
    }}>
      {children}
    </AppContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppContext)
