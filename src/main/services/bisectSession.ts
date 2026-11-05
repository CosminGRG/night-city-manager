import type { BisectAnswer, BisectView } from '@shared/types'
import { answerBisect, BisectSession, bisectStatus, startBisect, undoBisect } from './bisect'
import { deployStatuses } from './bulk'
import { deployMod, undeployMod, type DeployContext } from './deployer'

async function switchMods(
  context: DeployContext,
  gamePath: string,
  suspects: string[],
  off: Set<string>
): Promise<void> {
  const statuses = await deployStatuses(context)
  const mods = context.library.list().filter((mod) => suspects.includes(mod.id))

  for (const mod of mods) {
    if (off.has(mod.id) && statuses.has(mod.id)) {
      await undeployMod(context, mod)
    }
  }

  for (const mod of mods) {
    const status = statuses.get(mod.id)
    if (off.has(mod.id) || status === 'deployed') {
      continue
    }
    if (status) {
      await undeployMod(context, mod)
    }

    await deployMod(context, gamePath, mod)
  }
}

async function bisectView(context: DeployContext, session: BisectSession): Promise<BisectView> {
  const status = bisectStatus(session)
  const view = { status, total: session.suspects.length, answered: session.answers.length }

  if (status.kind !== 'testing') {
    return { ...view, ready: true }
  }

  const statuses = await deployStatuses(context)
  const off = new Set(status.off)
  const ready = context.library
    .list()
    .filter((mod) => session.suspects.includes(mod.id))
    .every((mod) => (off.has(mod.id) ? !statuses.has(mod.id) : statuses.get(mod.id) === 'deployed'))

  return { ...view, ready }
}

async function save(
  context: DeployContext,
  gamePath: string,
  session: BisectSession
): Promise<BisectView> {
  await context.manifests.writeBisect(session)

  const status = bisectStatus(session)
  if (status.kind === 'testing') {
    await switchMods(context, gamePath, session.suspects, new Set(status.off))
  }

  return bisectView(context, session)
}

async function currentSession(context: DeployContext): Promise<BisectSession> {
  const session = await context.manifests.readBisect()

  if (!session) {
    throw new Error('No bisect is running.')
  }

  return session
}

export async function getBisect(context: DeployContext): Promise<BisectView | null> {
  const session = await context.manifests.readBisect()
  return session ? bisectView(context, session) : null
}

export async function beginBisect(
  context: DeployContext,
  gamePath: string,
  suspects: string[],
  checkFirst: boolean
): Promise<BisectView> {
  if (await context.manifests.readBisect()) {
    throw new Error('A bisect is already running.')
  }

  const manifests = await context.manifests.list()
  if (manifests.some((manifests) => manifests.status !== 'deployed')) {
    throw new Error('Some mods were interrupted while deploying. Undeploy them first.s')
  }

  const deployed = new Set(manifests.map((manifests) => manifests.modId))
  const original = context.library
    .list()
    .filter((mod) => deployed.has(mod.id))
    .map((mod) => mod.id)

  const ordered = [...suspects].sort((a, b) => original.indexOf(a) - original.indexOf(b))

  return save(context, gamePath, startBisect(original, ordered, checkFirst))
}

export async function answerRound(
  context: DeployContext,
  gamePath: string,
  answer: BisectAnswer
): Promise<BisectView> {
  return save(context, gamePath, answerBisect(await currentSession(context), answer))
}

export async function undoRound(context: DeployContext, gamePath: string): Promise<BisectView> {
  return save(context, gamePath, undoBisect(await currentSession(context)))
}

export async function applyRound(context: DeployContext, gamePath: string): Promise<BisectView> {
  return save(context, gamePath, await currentSession(context))
}

export async function endBisect(
  context: DeployContext,
  gamePath: string,
  keepCulpritOff: boolean
): Promise<void> {
  const session = await currentSession(context)
  const status = bisectStatus(session)
  const off = new Set(keepCulpritOff && status.kind === 'found' ? [status.culprit] : [])

  await switchMods(context, gamePath, session.suspects, off)
  await context.manifests.removeBisect()
}
