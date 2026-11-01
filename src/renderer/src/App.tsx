import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { GameSetup } from './components/GameSetup'
import { ModList } from './components/ModList'
import { Sidebar, type View } from './components/Sidebar'
import { SettingsView } from './views/SettingsView'
import './App.css'
import { useImportQueue } from './useImportQueue'
import { ImportView } from './views/ImportView'
import { DropOverlay } from './components/DropOverlay'

function App(): React.JSX.Element {
  const [view, setView] = useState<View>('mods')
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

  function renderContent(): React.JSX.Element {
    if (!settings) return <p className="muted">Loading...</p>
    if (!settings.gamePath) return <GameSetup onSelected={setSettings} />
    if (view === 'settings') {
      return <SettingsView settings={settings} onSettingsChange={setSettings} />
    }

    if (view === 'import') {
      return <ImportView queue={queue} onPick={pickArchives} />
    }

    return <ModList importedCount={queue.imported} onImport={pickArchives} />
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
