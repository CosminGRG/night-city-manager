import type { BisectAnswer, BisectStatus } from '@shared/types'

export interface BisectSession {
  version: 1
  original: string[]
  suspects: string[]
  checkFirst: boolean
  answers: BisectAnswer[]
}

export function startBisect(
  original: string[],
  suspects: string[],
  checkFirst: boolean
): BisectSession {
  const unique = [...new Set(suspects)]

  if (unique.length < 2) throw new Error('Pick at least two mods to test.')
  if (!unique.every((id) => original.includes(id))) {
    throw new Error('Only deployed mods can be tested.')
  }

  return { version: 1, original, suspects: unique, checkFirst, answers: [] }
}

function halvingRoungs(count: number): number {
  return Math.ceil(Math.log2(count))
}

export function bisectStatus(session: BisectSession): BisectStatus {
  const { answers, checkFirst } = session
  let suspects = session.suspects
  let next = 0

  if (checkFirst) {
    if (answers.length === 0) {
      return {
        kind: 'testing',
        round: 1,
        checking: true,
        suspects,
        off: suspects,
        roundsLeft: 1 + halvingRoungs(suspects.length)
      }
    }
    if (answers[0] === 'broken') {
      return { kind: 'not-in-suspects' }
    }
    next = 1
  }

  while (suspects.length > 1) {
    const off = suspects.slice(0, Math.ceil(suspects.length / 2))
    if (next === answers.length) {
      return {
        kind: 'testing',
        round: next + 1,
        checking: false,
        suspects,
        off,
        roundsLeft: halvingRoungs(suspects.length)
      }
    }

    suspects = answers[next] === 'works' ? off : suspects.slice(off.length)
    next++
  }

  return { kind: 'found', culprit: suspects[0] }
}

export function answerBisect(session: BisectSession, answer: BisectAnswer): BisectSession {
  if (bisectStatus(session).kind !== 'testing') {
    throw new Error('This bisect has already ended.')
  }

  return { ...session, answers: [...session.answers, answer] }
}

export function undoBisect(session: BisectSession): BisectSession {
  if (session.answers.length === 0) {
    throw new Error('There is no answer to undo.')
  }
  return { ...session, answers: session.answers.slice(0, -1) }
}

function isIdList(data: unknown): data is string[] {
  return Array.isArray(data) && data.every((id) => typeof id === 'string')
}

export function isBisectSession(data: unknown): data is BisectSession {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const session = data as BisectSession

  return (
    session.version === 1 &&
    isIdList(session.original) &&
    isIdList(session.suspects) &&
    session.suspects.length >= 2 &&
    session.suspects.every((id) => session.original.includes(id)) &&
    typeof session.checkFirst === 'boolean' &&
    Array.isArray(session.answers) &&
    session.answers.every((answer) => answer === 'broken' || answer === 'works')
  )
}
