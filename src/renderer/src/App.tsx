import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { GameSetup } from './components/GameSetup'
import { ModList } from './components/ModList'
import { Sidebar, type View } from './components/Sidebar'
import { SettingsView } from './views/SettingsView'
import './App.css'

function App(): React.JSX.Element {
  const [view, setView] = useState<View>('mods')
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  function renderContent(): React.JSX.Element {
    if (!settings) return <p className="muted">Loading...</p>
    if (!settings.gamePath) return <GameSetup onSelected={setSettings} />
    if (view === 'settings') {
      return <SettingsView settings={settings} onSettingsChange={setSettings} />
    }
    return <ModList />
  }

  return (
    <div className="app">
      <Sidebar view={view} onChange={setView} />
      <main className="content">{renderContent()}</main>
    </div>
  )
}

export default App
