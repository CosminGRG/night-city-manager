import { describe, expect, it } from 'vitest'
import { createQueue } from './queue'

describe('createQueue', () => {
  it('runs tasks one at a time, in the order they were added', async () => {
    const run = createQueue()
    const log: string[] = []

    const slow = run(async () => {
      log.push('a starts')
      await new Promise((resolve) => setTimeout(resolve, 20))
      log.push('a ends')
    })
    const fast = run(async () => {
      log.push('b')
    })
    await Promise.all([slow, fast])

    expect(log).toEqual(['a starts', 'a ends', 'b'])
  })

  it('keeps going after a task fails', async () => {
    const run = createQueue()

    await expect(run(async () => Promise.reject(new Error('broken')))).rejects.toThrow('broken')
    expect(await run(async () => 42)).toBe(42)
  })
})
