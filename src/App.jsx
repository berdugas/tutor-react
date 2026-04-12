import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { supabase } from './lib/supabase'
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
    setGradeLevel, setSchoolQuarter,
    tala, setTala, appScreen, setAppScreen,
    profileLoading, setProfileLoading,
    resetApp
  } = useApp()

  // Restore profile from Supabase on first load
  useEffect(() => {
    async function restoreProfile() {
      try {
        // Retry loop — anonymous sign-in may still be resolving on mount
        let session = null
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data } = await supabase.auth.getSession()
          if (data?.session?.user?.id) {
            session = data.session
            break
          }
          await new Promise(r => setTimeout(r, 300))
        }

        if (!session) {
          setProfileLoading(false) // no session — show onboarding
          return
        }

        const { data: student } = await supabase
          .from('students')
          .select('name, grade_level, school_quarter, school_type, tala_total')
          .eq('id', session.user.id)
          .single()

        if (student) {
          setStudentName(student.name)
          if (student.grade_level) setGradeLevel(student.grade_level)
          if (student.school_quarter) setSchoolQuarter(student.school_quarter)
          if (student.tala_total !== undefined) setTala(student.tala_total)
          setAppScreen('upload')
        }
        // no student row — stay on name screen (run onboarding)
      } catch (err) {
        console.error('[AralMate] restoreProfile error:', err.message)
      } finally {
        setProfileLoading(false) // always clear loading
      }
    }
    restoreProfile()
  }, [setStudentName, setGradeLevel, setSchoolQuarter, setTala, setAppScreen, setProfileLoading])

  const leftContent = () => {
    if (appScreen === 'processing') return <ProcessingState />
    if (appScreen === 'confirming') return <ConfirmationCard />
    return <UploadZone />
  }

  const rightContent = () => {
    if (appScreen === 'results') return <LessonOutput />
    return <WelcomePanel studentName={studentName} visible={true} />
  }

  async function handleEditName(newName) {
    const name = newName.trim()
    if (!name) return
    setStudentName(name)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { error } = await supabase
          .from('students')
          .upsert({ id: session.user.id, name, updated_at: new Date().toISOString() })
        if (error) console.error('[AralMate] Name update failed:', error.message)
      }
    } catch (err) {
      console.error('[AralMate] Name update error:', err.message)
    }
  }

  // NameScreen onSave receives the full profile from step 3
  function handleOnboardingSave({ name, gradeLevel, schoolQuarter }) {
    setStudentName(name)
    if (gradeLevel) setGradeLevel(gradeLevel)
    if (schoolQuarter) setSchoolQuarter(schoolQuarter)
    setAppScreen('upload')
  }

  return (
    <>
      <TalaFlash />
      <AppShell
        studentName={studentName}
        tala={tala}
        profileLoading={profileLoading}
        onEditName={handleEditName}
        showReset={appScreen === 'results'}
        onReset={resetApp}
        leftChildren={
          appScreen === 'name'
            ? <NameScreen onSave={handleOnboardingSave} />
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
