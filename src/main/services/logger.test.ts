import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFileLogger, describeError, formatLine, hideHome, oldLogPath } from './logger'

const NOW = new Date(2026, 10, 14, 9, 5, 7, 42)

describe('formatLine', () => {
  it('starts with the local time and the level', () => {
    expect(formatLine('warn', 'Something odd', NOW)).toBe(
      '2026-11-14 09:05:07.042 [warn] Something odd\n'
    )
  })
})

describe('describeError', () => {
  it('follows the cause chain', () => {
    const cause = new Error('7-Zip said no')
    const text = describeError(new Error('Import failed', { cause }))

    expect(text).toMatch(/^Error: Import failed/)
    expect(text).toContain('caused by: Error: 7-Zip said no')
  })

  it('lists every error inside an AggregateError', () => {
    const error = new AggregateError([new Error('first'), new Error('second')], 'Rollback failed')
    const text = describeError(error)

    expect(text).toContain('includes: Error: first')
    expect(text).toContain('includes: Error: second')
  })

  it('handles things that are not errors, and loops', () => {
    expect(describeError('plain text')).toBe('plain text')

    const looped = new Error('looped')
    looped.cause = looped
    expect(describeError(looped)).toContain('(see above)')
  })
})

describe('hideHome', () => {
  it('replaces the user folder in either spelling, ignoring case', () => {
    const text = 'C:\\Users\\Cosmin\\Downloads\\a.zip and c:/users/cosmin/Desktop'

    expect(hideHome(text, 'C:\\Users\\Cosmin')).toBe(
      '%USERPROFILE%\\Downloads\\a.zip and %USERPROFILE%/Desktop'
    )
  })

  it('leaves the text alone without a user folder', () => {
    expect(hideHome('E:\\Games', '')).toBe('E:\\Games')
  })
})

describe('createFileLogger', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ncm-log-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('creates the folder and writes the lines in order', async () => {
    const file = join(dir, 'logs', 'fixer.log')
    const logger = createFileLogger(file, { now: () => NOW })

    logger.info('Started')
    logger.error('Deploy failed', new Error('disk full'))
    await logger.flush()

    const text = await readFile(file, 'utf8')
    expect(text).toMatch(/^2026-11-14 09:05:07.042 \[info\] Started\n/)
    expect(text).toContain('[error] Deploy failed\nError: disk full')
  })

  it('keeps one old log once the file grows too big', async () => {
    const file = join(dir, 'fixer.log')
    await writeFile(file, 'x'.repeat(20))
    await writeFile(oldLogPath(file), 'older still')

    const logger = createFileLogger(file, { maxBytes: 10, now: () => NOW })
    logger.info('New session')
    await logger.flush()

    expect(await readFile(oldLogPath(file), 'utf8')).toBe('x'.repeat(20))
    expect(await readFile(file, 'utf8')).toContain('New session')
  })

  it('never throws when it cannot write', async () => {
    await writeFile(join(dir, 'blocker'), '')
    const logger = createFileLogger(join(dir, 'blocker', 'fixer.log'))

    logger.error('Nowhere to go')
    await expect(logger.flush()).resolves.toBeUndefined()
  })
})
