import { EN, type MessageKey } from './en'
import type { Message, Values } from './messages'

export type Strings = Partial<Record<MessageKey, Message>>
export type Translate = (key: MessageKey, values?: Values) => string

const PLACEHOLDER = /\{(\w+)\}/g

export function fillIn(text: string, values: Values = {}): string {
  return text.replace(PLACEHOLDER, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  )
}

function pick(message: Message, rules: Intl.PluralRules, values?: Values): string {
  if (typeof message === 'string') {
    return message
  }

  const count = values?.count
  const category = typeof count === 'number' ? rules.select(count) : 'other'
  return message[category] ?? message.other
}

export function createTranslator(language: string, strings: Strings = {}): Translate {
  const rules = new Intl.PluralRules(language)
  const english = new Intl.PluralRules('en')

  return (key, values) => {
    const translated = strings[key]
    const text =
      translated === undefined ? pick(EN[key], english, values) : pick(translated, rules, values)

    return fillIn(text, values)
  }
}
