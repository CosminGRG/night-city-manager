import { createContext, useContext } from 'react'
import { createTranslator, type Translate } from '@shared/i18n/translate'

export interface I18n {
  language: string
  t: Translate
  reload: () => Promise<void>
}

export const I18nContext = createContext<I18n>({
  language: 'en',
  t: createTranslator('en'),
  reload: async () => {}
})

export function useT(): Translate {
  return useContext(I18nContext).t
}

export function useI18n(): I18n {
  return useContext(I18nContext)
}
