import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import AppShell from './components/AppShell/AppShell'
import WelcomePanel from './components/WelcomePanel/WelcomePanel'
import NameScreen from './components/NameScreen/NameScreen'
import UploadZone from './components/UploadZone/UploadZone'
import ProcessingState from './components/UploadZone/ProcessingState/ProcessingState'
import ConfirmationCard from './components/ConfirmationCard/ConfirmationCard'
import LessonOutput from './components/LessonOutput/LessonOutput'
import TalaFlash from './components/TalaFlash/TalaFlash'

function AralMateApp() {
  const {
    studentName, setStudentName,
    tala, appScreen, setAppScreen,
    resetApp
  } = useApp()

  // Restore name from localStorage on first load
  useEffect(() => {
    const saved = localStorage.getItem('am_student_name')
    if (saved) {
      setStudentName(saved)
      setAppScreen('upload')
    }
  }, [setStudentName, setAppScreen])

  const leftContent = () => {
    if (appScreen === 'processing') return <ProcessingState />
    if (appScreen === 'confirming') return <ConfirmationCard />
    return <UploadZone />
  }

  const rightContent = () => {
    if (appScreen === 'results') return <LessonOutput />
    return <WelcomePanel studentName={studentName} visible={true} />
  }

  function handleEditName(newName) {
    const name = newName.trim()
    if (!name) return
    setStudentName(name)
    localStorage.setItem('am_student_name', name)
  }

  return (
    <>
      <TalaFlash />
      <AppShell
        studentName={studentName}
        tala={tala}
        onEditName={handleEditName}
        showReset={appScreen === 'results'}
        onReset={resetApp}
        leftChildren={
          appScreen === 'name'
            ? <NameScreen onSave={(name) => { setStudentName(name); setAppScreen('upload') }} />
            : leftContent()
        }
        rightChildren={rightContent()}
      />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AralMateApp />
    </AppProvider>
  )
}
