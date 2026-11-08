import { describe, expect, it, vi } from 'vitest'
import {
  BATCH_SIZE,
  fetchFiles,
  fetchRequirements,
  filesQuery,
  parseFiles,
  parseRequirements,
  type Fetch
} from './nexus'

// Shape of a real answer (Always First Equip, 2026-11-06), plus an external requirement.
const ANSWER = {
  data: {
    legacyMods: {
      nodes: [
        {
          modId: 2557,
          modRequirements: {
            nexusRequirements: {
              nodes: [
                {
                  modId: '4575',
                  modName: 'Input Loader',
                  notes: '(Optional)',
                  externalRequirement: false
                },
                { modId: '1511', modName: 'redscript', notes: '', externalRequirement: false },
                { modId: '0', modName: 'ReShade', notes: '', externalRequirement: true }
              ]
            }
          }
        }
      ]
    }
  }
}

function fakeFetch(body: unknown, status = 200): ReturnType<typeof vi.fn<Fetch>> {
  return vi.fn<Fetch>(async () => new Response(JSON.stringify(body), { status }))
}

describe('parseRequirements', () => {
  it('reads Nexus requirements, marks optional ones and skips external ones', () => {
    expect(parseRequirements(ANSWER)).toEqual(
      new Map([
        [
          2557,
          [
            { nexusId: 4575, name: 'Input Loader', optional: true },
            { nexusId: 1511, name: 'redscript', optional: false }
          ]
        ]
      ])
    )
  })

  it('returns null for an answer it does not understand', () => {
    expect(parseRequirements({ data: { somethingElse: [] } })).toBeNull()
    expect(parseRequirements('not json')).toBeNull()
  })

  it('skips entries with broken fields instead of failing', () => {
    const broken = {
      data: {
        legacyMods: {
          nodes: [
            { modId: 'x' },
            { modId: 7, modRequirements: { nexusRequirements: { nodes: [{ modId: '-3' }] } } }
          ]
        }
      }
    }
    expect(parseRequirements(broken)).toEqual(new Map([[7, []]]))
  })
})

describe('fetchRequirements', () => {
  it('asks for every mod with the identifying headers', async () => {
    const fetch = fakeFetch(ANSWER)
    await fetchRequirements([2557], fetch, '1.2.0')

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.nexusmods.com/v2/graphql')
    expect(init.headers).toMatchObject({
      'Application-Name': 'NightCityModManager',
      'Application-Version': '1.2.0',
      'User-Agent': 'NightCityModManager/1.2.0'
    })
    expect(JSON.parse(String(init.body)).variables).toEqual({
      ids: [{ gameId: 3333, modId: 2557 }],
      count: 1
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('gives mods missing from the answer (hidden or deleted pages) no requirements', async () => {
    const result = await fetchRequirements([2557, 999999], fakeFetch(ANSWER), '1.0.0')
    expect(result.get(999999)).toEqual([])
    expect(result.get(2557)).toHaveLength(2)
  })

  it(`splits large libraries into batches of ${BATCH_SIZE}`, async () => {
    const fetch = fakeFetch({ data: { legacyMods: { nodes: [] } } })
    const ids = Array.from({ length: 120 }, (_, index) => index + 1)
    const result = await fetchRequirements(ids, fetch, '1.0.0')

    const counts = fetch.mock.calls.map(([, init]) => JSON.parse(String(init.body)).variables.count)
    expect(counts).toEqual([50, 50, 20])
    expect(result.size).toBe(120)
  })

  it('skips duplicate and invalid ids', async () => {
    const fetch = fakeFetch(ANSWER)
    await fetchRequirements([2557, 2557, 0, -1, 1.5], fetch, '1.0.0')
    expect(JSON.parse(String(fetch.mock.calls[0][1].body)).variables.count).toBe(1)
  })

  it('fails on HTTP errors, GraphQL errors and unknown answers, so nothing wrong is cached', async () => {
    await expect(fetchRequirements([1], fakeFetch({}, 403), '1.0.0')).rejects.toThrow('HTTP 403')
    await expect(
      fetchRequirements([1], fakeFetch({ errors: [{ message: 'too complex' }] }), '1.0.0')
    ).rejects.toThrow('could not answer')
    await expect(fetchRequirements([1], fakeFetch({ data: {} }), '1.0.0')).rejects.toThrow(
      'does not understand'
    )
  })

  it('makes no request for an empty library', async () => {
    const fetch = fakeFetch(ANSWER)
    expect(await fetchRequirements([], fetch, '1.0.0')).toEqual(new Map())
    expect(fetch).not.toHaveBeenCalled()
  })
})

// Shape of a real answer (CET, 2026-11-08), trimmed to two files.
const CET_FILES = [
  {
    fileId: 168615,
    sqid: 'ozVyzbb0n',
    groupId: 497182,
    name: 'CET 1.38.1 - Game version 2.5',
    version: '1.38.1',
    category: 'MAIN',
    date: 1792978138
  },
  {
    fileId: 167620,
    sqid: 'Q6xF6lly7',
    groupId: 497182,
    name: 'CET 1.38.0 - Game version 2.5',
    version: '1.38.0',
    category: 'OLD_VERSION',
    date: 1792673845
  }
]

describe('filesQuery', () => {
  it('asks for each mod under a numbered alias, with the ids left to variables', () => {
    expect(filesQuery(2)).toBe(
      'query Files($gameId: ID!, $m0: ID!, $m1: ID!) { ' +
        'f0: modFiles(modId: $m0, gameId: $gameId) { fileId sqid groupId name version category date } ' +
        'f1: modFiles(modId: $m1, gameId: $gameId) { fileId sqid groupId name version category date } }'
    )
  })
})

describe('parseFiles', () => {
  it('reads the files of each mod in the order they were asked for', () => {
    const files = parseFiles({ data: { f0: CET_FILES, f1: [] } }, [107, 99999])

    expect(files?.get(99999)).toEqual([])
    expect(files?.get(107)).toEqual([
      {
        fileId: 168615,
        sqid: 'ozVyzbb0n',
        groupId: 497182,
        name: 'CET 1.38.1 - Game version 2.5',
        version: '1.38.1',
        category: 'MAIN',
        uploadedAt: 1792978138
      },
      {
        fileId: 167620,
        sqid: 'Q6xF6lly7',
        groupId: 497182,
        name: 'CET 1.38.0 - Game version 2.5',
        version: '1.38.0',
        category: 'OLD_VERSION',
        uploadedAt: 1792673845
      }
    ])
  })

  it('keeps files without a version line and skips broken ones', () => {
    const [main] = CET_FILES
    const files = parseFiles(
      {
        data: {
          f0: [
            { ...main, groupId: null },
            { ...main, category: 'SOMETHING_NEW' },
            { ...main, sqid: '' },
            { ...main, date: 'yesterday' },
            'not a file'
          ]
        }
      },
      [107]
    )

    expect(files?.get(107)?.map((file) => file.groupId)).toEqual([null])
  })

  it('treats a mod Nexus answers with null as having no files', () => {
    expect(parseFiles({ data: { f0: null } }, [107])).toEqual(new Map([[107, []]]))
  })

  it('returns null for an answer it does not understand', () => {
    expect(parseFiles({ data: { f0: CET_FILES } }, [107, 790])).toBeNull()
    expect(parseFiles({ data: { f0: 'files' } }, [107])).toBeNull()
    expect(parseFiles('not json', [107])).toBeNull()
  })
})

describe('fetchFiles', () => {
  it('sends the mod ids as variables', async () => {
    const fetch = fakeFetch({ data: { f0: CET_FILES, f1: [] } })
    const files = await fetchFiles([107, 790], fetch, '1.0.0')

    expect(JSON.parse(String(fetch.mock.calls[0][1].body)).variables).toEqual({
      gameId: '3333',
      m0: '107',
      m1: '790'
    })
    expect(files.get(107)).toHaveLength(2)
  })

  it(`splits large libraries into batches of ${BATCH_SIZE}`, async () => {
    const fetch = vi.fn<Fetch>(async (_url, init) => {
      const { variables } = JSON.parse(String(init.body))
      const count = Object.keys(variables).length - 1
      const data = Object.fromEntries(Array.from({ length: count }, (_, i) => [`f${i}`, []]))
      return new Response(JSON.stringify({ data }))
    })
    const ids = Array.from({ length: 120 }, (_, index) => index + 1)
    const result = await fetchFiles(ids, fetch, '1.0.0')

    const counts = fetch.mock.calls.map(
      ([, init]) => Object.keys(JSON.parse(String(init.body)).variables).length - 1
    )
    expect(counts).toEqual([50, 50, 20])
    expect(result.size).toBe(120)
  })

  it('fails on errors and unknown answers, so nothing wrong is cached', async () => {
    await expect(fetchFiles([1], fakeFetch({}, 500), '1.0.0')).rejects.toThrow('HTTP 500')
    await expect(fetchFiles([1], fakeFetch({ data: {} }), '1.0.0')).rejects.toThrow(
      'does not understand'
    )
  })
})
