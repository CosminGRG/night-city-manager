import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findGameRoot } from './gameDetector'

let game: string

beforeEach(async () => {
  game = await mkdtemp(join(tmpdir(), 'ncm-game-'))
  await mkdir(join(game, 'bin', 'x64'), { recursive: true })
  await writeFile(join(game, 'bin', 'x64', 'Cyberpunk2077.exe'), '')
})

afterEach(async () => {
  await rm(game, { recursive: true, force: true })
})

describe('findGameRoot', () => {
  it.each([
    ['the game folder', []],
    ['bin', ['bin']],
    ['bin\\x64', ['bin', 'x64']]
  ])('finds the game folder when %s is picked', async (_label, parts) => {
    expect(await findGameRoot(join(game, ...parts))).toBe(game)
  })

  it('returns null for a folder that is not the game', async () => {
    expect(await findGameRoot(tmpdir())).toBeNull()
  })
})
