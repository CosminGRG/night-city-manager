import { isRecord } from '../guards'
import { EN, MESSAGE_KEYS } from './en'
import { PLURAL_CATEGORIES, type Message, type PluralMessage } from './messages'
import type { Strings } from './translate'

export interface LanguagePack {
  language: string
  name: string
  author: string
  fixer: string
  strings: Strings
}

const MAX_TEXT = 1000

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT
}

function textOr(value: unknown, fallback: string): string {
  return isText(value) ? value.trim() : fallback
}

function languageTag(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  try {
    return Intl.getCanonicalLocales(value)[0] ?? null
  } catch {
    //Not a valid language tag. don't throw in createTranslator
    return null
  }
}

function checkMessage(english: Message, value: unknown): Message | null {
  if (isText(value)) {
    return value
  }
  if (typeof english === 'string' || !isRecord(value) || !isText(value.other)) {
    return null
  }

  const forms: PluralMessage = { other: value.other }
  for (const category of PLURAL_CATEGORIES) {
    const form = value[category]

    if (isText(form)) {
      forms[category] = form
    }
  }

  return forms
}

export function checkPack(json: unknown): LanguagePack | null {
  if (!isRecord(json) || !isRecord(json.strings)) {
    return null
  }

  const language = languageTag(json.language)
  const name = textOr(json.name, '')

  if (language === null || name === '') {
    return null
  }

  const strings: Strings = {}
  for (const key of MESSAGE_KEYS) {
    const message = checkMessage(EN[key], json.strings[key])
    if (message !== null) {
      strings[key] = message
    }
  }

  return { language, name, author: textOr(json.author, ''), fixer: textOr(json.fixer, ''), strings }
}

export function completeness(strings: Strings): number {
  return Object.keys(strings).length / MESSAGE_KEYS.length
}
