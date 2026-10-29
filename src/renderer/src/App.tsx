import React, { useEffect, useState } from 'react'
import type { AppInfo } from 'src/shared/ipc'
import type { Settings } from 'src/shared/types'
import { GameSetup } from './components/GameSetup'

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
          <p>Game folder: {settings.gamePath}</p>
        ) : (
          <GameSetup onSelected={setSettings} />
        ))}
    </main>
  )
}

export default App
