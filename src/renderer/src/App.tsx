import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { GameSetup } from './components/GameSetup'
import { ModList } from './components/ModList'
import { Sidebar, type View } from './components/Sidebar'
import { DropOverlay } from './components/DropOverlay'
import { useImportQueue } from './useImportQueue'
import { ImportView } from './views/ImportView'
import { SettingsView } from './views/SettingsView'
import { TroubleshootView, type TroubleshootTab } from './views/TroubleshootView'
import './App.css'

function App(): React.JSX.Element {
  const [view, setView] = useState<View>('mods')
  const [troubleshootTab, setTroubleshootTab] = useState<TroubleshootTab>('overview')
  const [settings, setSettings] = useState<Settings | null>(null)
  const queue = useImportQueue()

  useEffect(() => {
    window.api.getSettings().then(setSettings)
  }, [])

  function importArchives(paths: string[]): void {
    queue.add(paths)
    setView('import')
  }

  async function pickArchives(): Promise<void> {
    const paths = await window.api.pickArchives()
    if (paths) importArchives(paths)
  }

  function openBisect(): void {
    setTroubleshootTab('bisect')
    setView('troubleshoot')
  }

  function renderContent(): React.JSX.Element {
    if (!settings) return <p className="muted">Loading...</p>
    if (!settings.gamePath) return <GameSetup settings={settings} onSettingsChange={setSettings} />

    if (view === 'import') {
      return <ImportView queue={queue} onPick={pickArchives} />
    }
    if (view === 'troubleshoot') {
      return <TroubleshootView tab={troubleshootTab} onTabChange={setTroubleshootTab} />
    }
    if (view === 'settings') {
      return <SettingsView settings={settings} onSettingsChange={setSettings} />
    }

    return (
      <ModList importedCount={queue.imported} onImport={pickArchives} onTroubleshoot={openBisect} />
    )
  }

  return (
    <div className="app">
      <Sidebar view={view} onChange={setView} />
      <main className="content">
        <div className="content-inner">{renderContent()}</div>
      </main>
      {settings?.gamePath && <DropOverlay onDrop={importArchives} />}
    </div>
  )
}

export default App
