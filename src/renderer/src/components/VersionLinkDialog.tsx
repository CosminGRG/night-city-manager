import { useEffect, useState } from 'react'
import type { ModRecord } from '@shared/types'
import { currentLink, linkOptions, type LinkOption } from '@renderer/versionsView'
import { ConfirmDialog } from './ConfirmDialog'
import { useT } from '@renderer/i18n/context'
import './VersionLinkDialog.css'

interface VersionLinkDialogProps {
  mod: ModRecord
  onSave: (target: LinkOption | null) => void
  onClose: () => void
}

interface Loaded {
  options: LinkOption[]
  initial: string | null
}

export function VersionLinkDialog({
  mod,
  onSave,
  onClose
}: VersionLinkDialogProps): React.JSX.Element {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [picked, setPicked] = useState<string | null | undefined>(undefined)
  const [query, setQuery] = useState('')
  const t = useT()

  useEffect(() => {
    Promise.all([window.api.listMods(), window.api.getVersionGroups()]).then(([mods, groups]) => {
      const fresh = mods.find((entry) => entry.id === mod.id) ?? mod
      const options = linkOptions(fresh, mods, groups)
      setLoaded({ options, initial: currentLink(fresh, groups, options) })
    })
  }, [mod])

  const selected = picked === undefined ? (loaded?.initial ?? null) : picked
  const words = query.trim().toLowerCase()
  const visible = (loaded?.options ?? []).filter((option) =>
    option.name.toLowerCase().includes(words)
  )

  return (
    <ConfirmDialog
      title={t('versionLink.title', { name: mod.name })}
      confirmLabel={t('common.save')}
      tone="primary"
      confirmDisabled={loaded === null}
      onConfirm={() => onSave(loaded?.options.find((option) => option.id === selected) ?? null)}
      onClose={onClose}
    >
      <p>{t('versionLink.intro')}</p>
      <input
        type="search"
        className="link-search"
        placeholder={t('versionLink.search')}
        aria-label={t('versionLink.search')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <fieldset className="link-options">
        <legend className="sr-only">{t('versionLink.legend')}</legend>
        <label className="link-option">
          <input
            type="radio"
            name="version-of"
            checked={selected === null}
            onChange={() => setPicked(null)}
          />
          {t('versionLink.separate')}
        </label>
        {visible.map((option) => (
          <label key={option.id} className="link-option" title={option.name}>
            <input
              type="radio"
              name="version-of"
              checked={selected === option.id}
              onChange={() => setPicked(option.id)}
            />
            <span className="link-name">{option.name}</span>
            {option.version && <span className="muted link-version">{option.version}</span>}
          </label>
        ))}
      </fieldset>
    </ConfirmDialog>
  )
}
