import { describe, expect, it } from 'vitest'
import { MESSAGE_KEYS } from './en'
import { checkPack, completeness } from './pack'

function pack(strings: unknown, extra: Record<string, unknown> = {}): unknown {
  return { language: 'ro', name: 'Română', author: 'V', fixer: '0.2.0', strings, ...extra }
}

describe('checkPack', () => {
  it('accepts a valid pack', () => {
    expect(checkPack(pack({ 'nav.mods': 'Moduri' }))).toEqual({
      language: 'ro',
      name: 'Română',
      author: 'V',
      fixer: '0.2.0',
      strings: { 'nav.mods': 'Moduri' }
    })
  })

  it('refuses a pack without strings, name or a valid language', () => {
    expect(checkPack(null)).toBeNull()
    expect(checkPack({ language: 'ro', name: 'Română' })).toBeNull()
    expect(checkPack(pack({}, { name: '  ' }))).toBeNull()
    expect(checkPack(pack({}, { language: 'not a language' }))).toBeNull()
  })

  it('writes the language tag the standard way', () => {
    expect(checkPack(pack({}, { language: 'PT-br' }))?.language).toBe('pt-BR')
  })

  it('drops unknown keys and wrong values', () => {
    const json = JSON.parse(
      '{ "nav.mods": 42, "nav.settings": "Setări", "made.up": "x", "__proto__": "y" }'
    )
    const strings = checkPack(pack(json))?.strings
    expect(strings).toEqual({ 'nav.settings': 'Setări' })
  })

  it('drops text that is too long', () => {
    expect(checkPack(pack({ 'nav.mods': 'x'.repeat(1001) }))?.strings).toEqual({})
  })

  it('keeps valid plural forms only', () => {
    const strings = checkPack(
      pack({ 'leftovers.moved': { one: 'unu', few: 7, other: 'multe', tons: 'x' } })
    )?.strings
    expect(strings).toEqual({ 'leftovers.moved': { one: 'unu', other: 'multe' } })
  })

  it('accepts plain text for a plural message, but not plurals for plain text', () => {
    const strings = checkPack(
      pack({ 'leftovers.moved': '{count}', 'nav.mods': { other: 'Moduri' } })
    )?.strings
    expect(strings).toEqual({ 'leftovers.moved': '{count}' })
  })

  it('refuses plural forms without other', () => {
    expect(checkPack(pack({ 'leftovers.moved': { one: 'unu' } }))?.strings).toEqual({})
  })
})

describe('completeness', () => {
  it('is the share of translated messages', () => {
    expect(completeness({})).toBe(0)
    expect(completeness({ 'nav.mods': 'Moduri' })).toBe(1 / MESSAGE_KEYS.length)
  })
})
