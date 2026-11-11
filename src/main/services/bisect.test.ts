import { describe, expect, it } from 'vitest'
import type { BisectAnswer } from '@shared/types'
import {
  answerBisect,
  bisectStatus,
  startBisect,
  undoBisect,
  isBisectSession,
  type BisectSession
} from './bisect'

const MODS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function answered(session: BisectSession, ...answers: BisectAnswer[]): BisectSession {
  return answers.reduce(answerBisect, session)
}

describe('startBisect', () => {
  it('needs at least two deployed mods to test', () => {
    expect(() => startBisect(['core', 'a'], ['a', 'a'], false)).toThrow(/at least two/)
    expect(() => startBisect(['a'], ['a', 'x'], false)).toThrow(/deployed/)
  })
})

describe('bisectStatus', () => {
  it('switches off the first half and keeps the culprit in the half that matters', () => {
    const session = startBisect(['core', ...MODS], MODS, false)
    expect(bisectStatus(session)).toMatchObject({
      round: 1,
      off: ['a', 'b', 'c', 'd'],
      roundsLeft: 3
    })

    const works = answered(session, 'works')
    expect(bisectStatus(works)).toMatchObject({ round: 2, suspects: ['a', 'b', 'c', 'd'] })

    const broken = answered(works, 'broken')
    expect(bisectStatus(broken)).toMatchObject({ suspects: ['c', 'd'], off: ['c'] })

    expect(bisectStatus(answered(broken, 'works'))).toEqual({ kind: 'found', culprit: 'c' })
  })

  it('switches off the larger half of an odd number of mods', () => {
    const session = startBisect(MODS.slice(0, 5), MODS.slice(0, 5), false)
    expect(bisectStatus(session)).toMatchObject({ off: ['a', 'b', 'c'] })
  })

  it('starts with every suspect off when asked to check first', () => {
    const session = startBisect(MODS, MODS, true)
    expect(bisectStatus(session)).toMatchObject({ checking: true, off: MODS, roundsLeft: 4 })
    expect(bisectStatus(answered(session, 'broken'))).toEqual({ kind: 'not-in-suspects' })
    expect(bisectStatus(answered(session, 'works'))).toMatchObject({
      round: 2,
      checking: false,
      off: ['a', 'b', 'c', 'd']
    })
  })

  it('finds any culprit in at most log2(n) rounds', () => {
    for (let count = 2; count <= 40; count++) {
      const mods = Array.from({ length: count }, (_, index) => `m${index}`)
      for (const culprit of mods) {
        let session = startBisect(mods, mods, false)
        let rounds = 0
        let status = bisectStatus(session)
        while (status.kind === 'testing') {
          session = answerBisect(session, status.off.includes(culprit) ? 'works' : 'broken')
          status = bisectStatus(session)
          rounds++
        }
        expect(bisectStatus(session)).toEqual({ kind: 'found', culprit })
        expect(rounds).toBeLessThanOrEqual(Math.ceil(Math.log2(count)))
      }
    }
  })
})

describe('answers and undo', () => {
  it('refuses answers after the end and undoes the last one', () => {
    const session = answered(startBisect(['a', 'b'], ['a', 'b'], false), 'works')
    expect(() => answerBisect(session, 'works')).toThrow(/already ended/)
    expect(bisectStatus(undoBisect(session))).toMatchObject({ round: 1 })
    expect(() => undoBisect(undoBisect(session))).toThrow(/no answer/)
  })
})

describe('isBisectSession', () => {
  it('accepts a saved session and rejects one that makes no sense', () => {
    const session = answered(startBisect(MODS, MODS, true), 'works')
    expect(isBisectSession(JSON.parse(JSON.stringify(session)))).toBe(true)

    expect(isBisectSession({ ...session, answers: ['maybe'] })).toBe(false)
    expect(isBisectSession({ ...session, suspects: ['a'] })).toBe(false)
    expect(isBisectSession({ ...session, suspects: ['a', 'x'] })).toBe(false)
    expect(isBisectSession(null)).toBe(false)
  })
})
