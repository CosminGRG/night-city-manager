import React, { useEffect, useState } from 'react'
import type { AppInfo } from '@shared/ipc'
import type { Settings } from '@shared/types'
import { GameSetup } from './components/GameSetup'
import { ModList } from './components/ModList'

function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    window.api.getAppInfo().then(setInfo)
    window.api.getSettings().then(setSettings)
  }, [])

  return (
    <main>
      <h1>Night City Mod Manager</h1>
      {info ? (
        <p>
          v{info.version} · Electron {info.electronVersion} · data: {info.userDataPath}
        </p>
      ) : (
        <p>Loading...</p>
      )}
      {settings &&
        (settings.gamePath ? (
          <>
            <p className="muted">Game folder: {settings.gamePath}</p>
            <ModList />
          </>
        ) : (
          <GameSetup onSelected={setSettings} />
        ))}
    </main>
  )
}

export default App
