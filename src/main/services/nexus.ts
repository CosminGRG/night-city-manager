import type { NexusRequirement } from '@shared/types'

export const NEXUS_GRAPHQL_URL = 'https://api.nexusmods.com/v2/graphql'
export const APPLICATION_NAME = 'NightCityModManager'
export const CYBERPUNK_GAME_ID = 3333
export const BATCH_SIZE = 50
const TIMEOUT_MS = 15_000

const QUERY = `query Requirements($ids: [CompositeIdInput!]!, $count: Int) {
  legacyMods(ids: $ids, count: $count) {
    nodes {
      modId
      modRequirements {
        nexusRequirements {
          nodes { modId modName notes externalRequirement }
        }
      }
    }
  }
}`

export type Fetch = (url: string, init: RequestInit) => Promise<Response>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toNexusId(value: unknown): number | null {
  const id = typeof value === 'string' ? Number(value) : value
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? id : null
}

function nodesOf(page: unknown): unknown[] | null {
  return isRecord(page) && Array.isArray(page.nodes) ? page.nodes : null
}

function parseRequirement(value: unknown): NexusRequirement | null {
  if (!isRecord(value) || value.externalRequirement === true) {
    return null
  }

  const nexusId = toNexusId(value.modId)
  if (nexusId === null || typeof value.modName !== 'string') {
    return null
  }

  const notes = typeof value.notes === 'string' ? value.notes : ''
  return { nexusId, name: value.modName, optional: /optional/i.test(notes) }
}

export function parseRequirements(json: unknown): Map<number, NexusRequirement[]> | null {
  const data = isRecord(json) && isRecord(json.data) ? json.data : null
  const mods = nodesOf(data?.legacyMods)
  if (!mods) {
    return null
  }

  const result = new Map<number, NexusRequirement[]>()
  for (const mod of mods) {
    if (!isRecord(mod)) continue

    const nexusId = toNexusId(mod.modId)
    if (nexusId === null) continue

    const page = isRecord(mod.modRequirements) ? mod.modRequirements.nexusRequirements : null
    const requirements = (nodesOf(page) ?? [])
      .map(parseRequirement)
      .filter((requirement) => requirement !== null)

    result.set(nexusId, requirements)
  }

  return result
}

async function fetchBatch(
  batch: number[],
  fetch: Fetch,
  appVersion: string
): Promise<Map<number, NexusRequirement[]>> {
  const response = await fetch(NEXUS_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Application-Name': APPLICATION_NAME,
      'Application-Version': appVersion,
      'User-Agent': `${APPLICATION_NAME}/${appVersion}`
    },
    body: JSON.stringify({
      query: QUERY,
      variables: {
        ids: batch.map((modId) => ({ gameId: CYBERPUNK_GAME_ID, modId })),
        count: batch.length
      }
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(`Nexus Mods answered with HTTP ${response.status}.`)
  }

  const json: unknown = await response.json()
  if (isRecord(json) && Array.isArray(json.errors) && json.errors.length > 0) {
    throw new Error('Nexus Mods could not answer the request.')
  }

  const parsed = parseRequirements(json)
  if (!parsed) {
    throw new Error('Nexus Mods sent an answer this version does not understand.')
  }

  return parsed
}

export async function fetchRequirements(
  ids: number[],
  fetch: Fetch,
  appVersion: string
): Promise<Map<number, NexusRequirement[]>> {
  const unique = [...new Set(ids)].filter((id) => toNexusId(id) !== null)
  const result = new Map<number, NexusRequirement[]>()

  for (let start = 0; start < unique.length; start += BATCH_SIZE) {
    const batch = unique.slice(start, start + BATCH_SIZE)
    const parsed = await fetchBatch(batch, fetch, appVersion)

    for (const id of batch) {
      result.set(id, parsed.get(id) ?? [])
    }
  }

  return result
}
