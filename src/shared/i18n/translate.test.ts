import { describe, expect, it } from 'vitest'
import { createTranslator, fillIn } from './translate'

describe('fillIn', () => {
  it('replaces placeholders with values', () => {
    expect(fillIn('{name} has {count} files', { name: 'CET', count: 19 })).toBe('CET has 19 files')
  })

  it('leaves unknown placeholders visible', () => {
    expect(fillIn('Hello {nmae}', { name: 'V' })).toBe('Hello {nmae}')
  })

  it('ignores names inherited from Object', () => {
    expect(fillIn('{toString}')).toBe('{toString}')
  })
})

describe('createTranslator', () => {
  it('uses English without a pack', () => {
    const t = createTranslator('en')
    expect(t('nav.mods')).toBe('Mod list')
    expect(t('mods.deployedInstead', { name: 'CET' })).toBe('CET is deployed in its place.')
  })

  it('picks the English plural form', () => {
    const t = createTranslator('en')
    expect(t('leftovers.moved', { count: 1 })).toBe('Moved 1 leftover file to the Recycle Bin.')
    expect(t('leftovers.moved', { count: 0 })).toBe('Moved 0 leftover files to the Recycle Bin.')
  })

  it('uses the plural rules of the pack language', () => {
    const t = createTranslator('ro', {
      'leftovers.moved': {
        one: 'Am mutat {count} fișier.',
        few: 'Am mutat {count} fișiere.',
        other: 'Am mutat {count} de fișiere.'
      }
    })
    expect(t('leftovers.moved', { count: 1 })).toBe('Am mutat 1 fișier.')
    expect(t('leftovers.moved', { count: 5 })).toBe('Am mutat 5 fișiere.')
    expect(t('leftovers.moved', { count: 20 })).toBe('Am mutat 20 de fișiere.')
  })

  it('falls back to other when the pack lacks a form', () => {
    const t = createTranslator('ro', { 'leftovers.moved': { other: '{count} fișiere' } })
    expect(t('leftovers.moved', { count: 1 })).toBe('1 fișiere')
  })

  it('falls back to English for missing keys', () => {
    const t = createTranslator('ro', { 'nav.mods': 'Moduri' })
    expect(t('nav.mods')).toBe('Moduri')
    expect(t('nav.settings')).toBe('Settings')
  })
})
