import { describe, expect, it } from 'vitest'
import { createTranslator } from '../../shared/i18n/translate'
import type { LanguageInfo } from '../../shared/types'
import { isListed, optionLabel, percentOf } from './languagesView'

const t = createTranslator('en')

function info(complete: number, author = 'V'): LanguageInfo {
  return { file: 'ro.json', language: 'ro', name: 'Română', author, fixer: '0.2.0', complete }
}

describe('percentOf', () => {
  it('only shows 100 when nothing is missing', () => {
    expect(percentOf(0)).toBe(0)
    expect(percentOf(0.999)).toBe(99)
    expect(percentOf(1)).toBe(100)
  })
})

describe('optionLabel', () => {
  it('shows the name, how complete it is and the author', () => {
    expect(optionLabel(info(0.875), t)).toBe('Română · 87% · by V')
  })

  it('leaves out an empty author', () => {
    expect(optionLabel(info(1, ''), t)).toBe('Română · 100%')
  })
})

describe('isListed', () => {
  it('finds a file in the list', () => {
    expect(isListed('ro.json', [info(1)])).toBe(true)
    expect(isListed('de.json', [info(1)])).toBe(false)
  })
})
