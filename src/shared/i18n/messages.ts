export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const
export type PluralCategory = (typeof PLURAL_CATEGORIES)[number]

//A message that depends on a number
export type PluralMessage = Partial<Record<PluralCategory, string>> & { other: string }
export type Message = string | PluralMessage

export type Values = Record<string, string | number>
