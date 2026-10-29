import React, { useEffect, useState } from 'react'
import type { AppInfo } from 'src/shared/ipc'

function App(): React.JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.api.getAppInfo().then(setInfo)
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
    </main>
  )
}

export default App
