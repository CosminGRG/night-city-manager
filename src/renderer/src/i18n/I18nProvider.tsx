import { useCallback, useEffect, useMemo, useState } from 'react'
import { createTranslator } from '@shared/i18n/translate'
import type { LanguagePack } from '@shared/i18n/pack'
import { I18nContext, type I18n } from './context'

function loadPack(): Promise<LanguagePack | null> {
  return window.api.getLanguage().catch(() => null)
}

export function I18nProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [pack, setPack] = useState<LanguagePack | null | undefined>(undefined)

  useEffect(() => {
    loadPack().then(setPack)
  }, [])

  const language = pack?.language ?? 'en'

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const reload = useCallback(async () => setPack(await loadPack()), [])

  const value = useMemo<I18n>(
    () => ({
      language,
      t: createTranslator(language, pack?.strings),
      reload
    }),
    [language, pack, reload]
  )

  if (pack === undefined) {
    return <></>
  }
  return <I18nContext value={value}>{children}</I18nContext>
}
