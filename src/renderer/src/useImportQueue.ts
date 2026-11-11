import { useRef, useState } from 'react'
import type { ModRecord } from '@shared/types'

export type ImportStatus = 'queued' | 'importing' | 'done' | 'duplicate' | 'failed'

export interface ImportItem {
  key: number
  name: string
  path: string
  status: ImportStatus
  message: string | null
  mod: ModRecord | null
  versionNote: string | null
}

export interface ImportQueue {
  items: ImportItem[]
  imported: number
  add: (paths: string[]) => void
  clearFinished: () => void
  noteVersion: (key: number, note: string) => void
}

let nextKey = 1

export function isFinished(item: ImportItem): boolean {
  return item.status !== 'queued' && item.status !== 'importing'
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function useImportQueue(): ImportQueue {
  const [items, setItems] = useState<ImportItem[]>([])
  const [imported, setImported] = useState(0)
  const pending = useRef<ImportItem[]>([])
  const running = useRef(false)

  function update(key: number, change: Partial<ImportItem>): void {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...change } : item)))
  }

  async function run(): Promise<void> {
    running.current = true
    try {
      for (let item = pending.current.shift(); item; item = pending.current.shift()) {
        update(item.key, { status: 'importing' })
        const result = await window.api.importMod(item.path)
        if (!result.ok) {
          update(item.key, { status: 'failed', message: result.error })
        } else if (result.value.kind === 'duplicate') {
          const message = `Already in your library as "${result.value.mod.name}"`
          update(item.key, { status: 'duplicate', message })
        } else {
          update(item.key, { status: 'done', name: result.value.mod.name, mod: result.value.mod })
          setImported((count) => count + 1)
        }
      }
    } finally {
      running.current = false
    }
  }

  function add(paths: string[]): void {
    const fresh: ImportItem[] = paths.map((path) => ({
      key: nextKey++,
      name: fileName(path),
      path,
      status: 'queued',
      message: null,
      mod: null,
      versionNote: null
    }))
    setItems((current) => [...current, ...fresh])
    pending.current.push(...fresh)
    if (!running.current) run()
  }

  function clearFinished(): void {
    setItems((current) => current.filter((item) => !isFinished(item)))
  }

  function noteVersion(key: number, note: string): void {
    update(key, { versionNote: note })
  }

  return { items, imported, add, clearFinished, noteVersion }
}
