import { useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import { useT } from '@renderer/i18n/context'
import './SearchBox.css'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBox({ value, onChange }: SearchBoxProps): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null)
  const t = useT()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.ctrlKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <label className="search">
      <Search size={16} aria-hidden="true" />
      <input
        ref={input}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t('mods.searchPlaceholder')}
        aria-label={t('mods.search')}
        spellCheck={false}
      />
    </label>
  )
}
