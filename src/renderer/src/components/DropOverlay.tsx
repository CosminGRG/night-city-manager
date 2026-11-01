import { useState, useEffect } from 'react'
import { PackagePlus } from 'lucide-react'
import './DropOverlay.css'

interface DropOverlayProps {
  onDrop: (paths: string[]) => void
}

export function DropOverlay({ onDrop }: DropOverlayProps): React.JSX.Element | null {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function show(event: DragEvent): void {
      if (event.dataTransfer?.types.includes('Files')) setVisible(true)
    }

    function block(event: DragEvent): void {
      event.preventDefault()
    }

    window.addEventListener('dragenter', show)
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)

    return () => {
      window.removeEventListener('dragenter', show)
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  function handleDrop(event: React.DragEvent): void {
    event.preventDefault()
    setVisible(false)
    const paths = Array.from(event.dataTransfer.files, (file) =>
      window.api.getPathForFile(file)
    ).filter((path) => path !== '')
    if (paths.length > 0) onDrop(paths)
  }

  if (!visible) return null

  return (
    <div
      className="drop-overlay"
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setVisible(false)}
      onDrop={handleDrop}
    >
      <div className="drop-overlay-panel">
        <PackagePlus size={40} aria-hidden="true" />
        <p>Drop to import</p>
      </div>
    </div>
  )
}
