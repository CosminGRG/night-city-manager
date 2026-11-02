import { describe, expect, it } from 'vitest'
import { GAME_IMAGE, isImageListed } from './gameProcess'

describe('isImageListed', () => {
  it('finds the game in tasklist CSV output', () => {
    const output = '"Cyberpunk2077.exe","11480","Console","1","3,456,789 K"\r\n'
    expect(isImageListed(output, GAME_IMAGE)).toBe(true)
  })

  it('ignores case', () => {
    expect(isImageListed('"cyberpunk2077.EXE","1","Console","1","1 K"\r\n', GAME_IMAGE)).toBe(true)
  })

  it.each([
    'INFO: No tasks are running which match the specified criteria.\r\n',
    'INFORMATION: Es werden keine Aufgaben mit den angegebenen Kriterien ausgeführt.\r\n',
    '"Cyberpunk2077Launcher.exe","1","Console","1","1 K"\r\n',
    ''
  ])('is false for %j', (output) => {
    expect(isImageListed(output, GAME_IMAGE)).toBe(false)
  })
})
