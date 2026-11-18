import type { Translate } from '@shared/i18n/translate'
import type { LanguageInfo } from '@shared/types'

export function percentOf(complete: number): number {
  return Math.floor(complete * 100)
}

export function optionLabel(info: LanguageInfo, t: Translate): string {
  const values = { name: info.name, percent: percentOf(info.complete), author: info.author }
  return info.author === ''
    ? t('settings.language.optionNoAuthor', values)
    : t('settings.language.option', values)
}

export function isListed(file: string, languages: LanguageInfo[]): boolean {
  return languages.some((info) => info.file === file)
}
