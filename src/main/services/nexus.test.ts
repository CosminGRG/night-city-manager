import { describe, expect, it, vi } from 'vitest'
import { BATCH_SIZE, fetchRequirements, parseRequirements, type Fetch } from './nexus'

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
