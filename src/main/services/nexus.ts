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

export const FILE_CATEGORIES = [
  'MAIN',
  'UPDATE',
  'OPTIONAL',
  'OLD_VERSION',
  'MISCELLANEOUS',
  'REMOVED',
  'ARCHIVED'
] as const

export type NexusFileCategory = (typeof FILE_CATEGORIES)[number]

export interface NexusFile {
  fileId: number
  sqid: string
  groupId: number | null
  name: string
  version: string
  category: NexusFileCategory
  uploadedAt: number
}

const FILE_FIELDS = 'fileId sqid groupId name version category date'

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

async function postQuery(
  query: string,
  variables: Record<string, unknown>,
  fetch: Fetch,
  appVersion: string
): Promise<unknown> {
  const response = await fetch(NEXUS_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Application-Name': APPLICATION_NAME,
      'Application-Version': appVersion,
      'User-Agent': `${APPLICATION_NAME}/${appVersion}`
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  })

  if (!response.ok) {
    throw new Error(`Nexus Mods answered with HTTP ${response.status}.`)
  }

  const json: unknown = await response.json()
  if (isRecord(json) && Array.isArray(json.errors) && json.errors.length > 0) {
    throw new Error('Nexus Mods could not answer the request.')
  }

  return json
}

function understood<T>(parsed: T | null): T {
  if (parsed === null) {
    throw new Error('Nexus Mods sent an answer this version does not understand.')
  }

  return parsed
}

async function inBatches<T>(
  ids: number[],
  fetchBatch: (batch: number[]) => Promise<Map<number, T[]>>
): Promise<Map<number, T[]>> {
  const unique = [...new Set(ids)].filter((id) => toNexusId(id) !== null)
  const result = new Map<number, T[]>()

  for (let start = 0; start < unique.length; start += BATCH_SIZE) {
    const batch = unique.slice(start, start + BATCH_SIZE)
    const parsed = await fetchBatch(batch)

    for (const id of batch) {
      result.set(id, parsed.get(id) ?? [])
    }
  }

  return result
}

export function fetchRequirements(
  ids: number[],
  fetch: Fetch,
  appVersion: string
): Promise<Map<number, NexusRequirement[]>> {
  return inBatches(ids, async (batch) => {
    const variables = {
      ids: batch.map((modId) => ({ gameId: CYBERPUNK_GAME_ID, modId })),
      count: batch.length
    }

    return understood(parseRequirements(await postQuery(QUERY, variables, fetch, appVersion)))
  })
}

export function filesQuery(count: number): string {
  const indexes = Array.from({ length: count }, (_, index) => index)
  const params = indexes.map((index) => `$m${index}: ID!`).join(', ')
  const fields = indexes.map(
    (index) => `f${index}: modFiles(modId: $m${index}, gameId: $gameId) { ${FILE_FIELDS} }`
  )

  return `query Files($gameId: ID!, ${params}) { ${fields.join(' ')} }`
}

export function isCategory(value: unknown): value is NexusFileCategory {
  return FILE_CATEGORIES.some((category) => category === value)
}

function parseFile(value: unknown): NexusFile | null {
  if (!isRecord(value)) {
    return null
  }

  const fileId = toNexusId(value.fileId)
  const uploadedAt = toNexusId(value.date)
  const groupId = toNexusId(value.groupId)
  const { sqid, name, version, category } = value

  if (fileId === null || uploadedAt === null || (groupId === null && value.groupId !== null)) {
    return null
  }
  if (typeof sqid !== 'string' || sqid === '' || typeof name !== 'string') {
    return null
  }
  if (typeof version !== 'string' || !isCategory(category)) {
    return null
  }

  return { fileId, sqid, groupId, name, version, category, uploadedAt }
}

export function parseFiles(json: unknown, ids: number[]): Map<number, NexusFile[]> | null {
  const data = isRecord(json) && isRecord(json.data) ? json.data : null
  if (!data) {
    return null
  }

  const result = new Map<number, NexusFile[]>()
  for (const [index, id] of ids.entries()) {
    const files = data[`f${index}`]
    if (files === null) {
      result.set(id, [])
      continue
    }
    if (!Array.isArray(files)) {
      return null
    }

    result.set(
      id,
      files.map(parseFile).filter((file) => file !== null)
    )
  }

  return result
}

export function fetchFiles(
  ids: number[],
  fetch: Fetch,
  appVersion: string
): Promise<Map<number, NexusFile[]>> {
  return inBatches(ids, async (batch) => {
    const variables: Record<string, unknown> = { gameId: String(CYBERPUNK_GAME_ID) }
    for (const [index, id] of batch.entries()) {
      variables[`m${index}`] = String(id)
    }

    const json = await postQuery(filesQuery(batch.length), variables, fetch, appVersion)
    return understood(parseFiles(json, batch))
  })
}
