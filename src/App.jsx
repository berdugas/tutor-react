import AppShell from './components/AppShell/AppShell'
import WelcomePanel from './components/WelcomePanel/WelcomePanel'

export default function App() {
  return (
    <AppShell
      studentName="Miguel"
      tala={145}
      leftChildren={<div style={{padding: '20px', color: 'var(--muted)'}}>Left column — coming in Phase 2</div>}
      rightChildren={<WelcomePanel studentName="Miguel" visible={true} />}
    />
  )
}
