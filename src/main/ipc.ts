import { app, ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { stat } from 'fs/promises'
import { join, win32 } from 'path'
import { IpcChannels, type AppInfo } from '@shared/ipc'
import type {
  DetectedGame,
  Settings,
  Result,
  ModRecord,
  DeployStatus,
  UndeployResult,
  BulkRequest,
  BulkResult,
  ModsFolderInfo,
  LeftoverGroup,
  CleanResult,
  BisectView,
  NexusRequirement,
  GameLogs,
  ModUpdate,
  ImportOutcome,
  VersionGroup
} from '@shared/types'
import { detectInstalled } from './services/frameworks'
import type { SettingsStore } from './services/settings'
import { detectGames, findGameRoot, gameExe, isGameFolder } from './services/gameDetector'
import type { ModLibrary } from './services/modLibrary'
import type { AppPaths } from './services/paths'
import { importMod } from './services/importer'
import type { Dependency } from '@shared/requirements'
import { gameKey, type GameManifests } from './services/manifests'
import { createQueue } from './services/queue'
import { type DeployContext, undeployMod } from './services/deployer'
import { ARCHIVE_EXTENSIONS, checkArchivePath } from './services/archivePath'
import { stagingFolderFor } from './services/staging'
import { deployAll, purgeAll, removeAll, deployStatuses } from './services/bulk'
import type { RemoveContext } from './services/removal'
import { isGameRunning, launchExe, readLaunchEnvironment } from './services/gameProcess'
import { checkNewModsFolder, moveMods, sameDrive } from './services/modsFolder'
import { deployWithRequirements, requirementsToDeploy } from './services/autoRequirements'
import {
  cleanLeftovers,
  scanLeftovers,
  cleanUnusedLeftovers,
  cleanModLeftovers
} from './services/leftovers'
import {
  answerRound,
  applyRound,
  beginBisect,
  endBisect,
  getBisect,
  undoRound
} from './services/bisectSession'
import { NexusLookup } from './services/nexusLookup'
import { checkCrashReports, findLog, scanLogs } from './services/logs'
import { versionGroups } from './services/versions'
import { deployVersion, removeVersions } from './services/versionSwitch'
import { checkVersionLink } from './services/versionLinks'
import { prepareRedMods, redModFolders, runRedMod } from './services/redmod'
import type { Logger } from './services/logger'

interface IpcDependencies {
  settings: SettingsStore
  library: ModLibrary
  paths: AppPaths
  games: GameManifests
  nexus: NexusLookup
  logger: Logger
}

export function registerIpcHandlers({
  settings,
  library,
  paths,
  games,
  nexus,
  logger
}: IpcDependencies): void {
  const runExclusive = createQueue()
  const runImport = createQueue()

  async function setGamePath(path: string): Promise<Result<Settings>> {
    const gamePath = await findGameRoot(path)
    if (!gamePath) {
      return {
        ok: false,
        error: `"${path}" is not a Cyberpunk 2077 folder. Select the folder that contains "bin", "archive" and "r6".`
      }
    }

    return { ok: true, value: await settings.update({ gamePath }) }
  }

  function findMod(modId: unknown): ModRecord {
    if (typeof modId !== 'string') throw new Error('modId must be a string')
    const mod = library.list().find((candidate) => candidate.id === modId)
    if (!mod) throw new Error('This mod is not in the library.')
    return mod
  }

  function nexusPageOf(modId: unknown): string {
    const { nexusModId } = findMod(modId)
    if (!Number.isSafeInteger(nexusModId) || nexusModId === null || nexusModId <= 0) {
      throw new Error('This mod has no Nexus page.')
    }

    return `https://www.nexusmods.com/cyberpunk2077/mods/${nexusModId}`
  }

  function otherVersionsOf(mod: ModRecord): ModRecord[] {
    const mods = library.list()
    const group = versionGroups(mods, nexus.files()).find(({ modIds }) => modIds.includes(mod.id))
    const ids = group?.modIds.filter((id) => id !== mod.id) ?? []
    return ids.flatMap((id) => mods.filter((other) => other.id === id))
  }

  function modsDir(): string {
    return settings.get().modsPath ?? paths.mods
  }

  function currentGame(): string {
    const { gamePath } = settings.get()
    if (!gamePath) throw new Error('Choose your game folder first.')
    return gamePath
  }

  function deployContext(gamePath: string): DeployContext & RemoveContext {
    return {
      modsDir: modsDir(),
      backupsDir: join(paths.data, 'backups', gameKey(gamePath)),
      manifests: games.forGame(gamePath),
      library,
      games
    }
  }

  async function toResult<T>(task: () => Promise<T>): Promise<Result<T>> {
    try {
      return { ok: true, value: await task() }
    } catch (error) {
      logger.error('An action failed', error)
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  async function refuseWhileBisecting(gamePath: string): Promise<void> {
    if (await games.forGame(gamePath).readBisect()) {
      throw new Error('A bisect is running. Finish or stop it on the Troubleshoot screen first.')
    }
  }

  function bisectTask<T>(
    task: (context: DeployContext, gamePath: string) => Promise<T>
  ): Promise<Result<T>> {
    return runExclusive(() =>
      toResult(async () => {
        await refuseWhileGameRuns()
        const gamePath = currentGame()
        return task(deployContext(gamePath), gamePath)
      })
    )
  }

  ipcMain.handle(IpcChannels.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    userDataPath: app.getPath('userData')
  }))

  ipcMain.handle(IpcChannels.getSettings, (): Settings => settings.get())

  ipcMain.handle(
    IpcChannels.setNexusLookup,
    (_event, enabled: unknown): Promise<Result<Settings>> => {
      if (typeof enabled !== 'boolean') {
        throw new Error('setNexusLookup: enabled must be a boolean')
      }

      return toResult(async () => {
        const updated = await settings.update({ nexusLookup: enabled })
        if (enabled) {
          nexus.refreshInBackground()
        }
        return updated
      })
    }
  )

  ipcMain.handle(
    IpcChannels.setAutoDeployRequirements,
    (_event, enabled: unknown): Promise<Result<Settings>> => {
      if (typeof enabled !== 'boolean') {
        throw new Error('setAutoDeployRequirements: enabled must be a boolean')
      }

      return toResult(() => settings.update({ autoDeployRequirements: enabled }))
    }
  )

  ipcMain.handle(IpcChannels.getGameIcon, async (): Promise<string | null> => {
    const { gamePath } = settings.get()
    if (!gamePath) {
      return null
    }

    try {
      const icon = await app.getFileIcon(gameExe(gamePath), { size: 'large' })
      return icon.isEmpty() ? null : icon.toDataURL()
    } catch {
      return null
    }
  })

  ipcMain.handle(IpcChannels.launchGame, (event): Promise<Result<null>> =>
    runExclusive(() =>
      toResult(async () => {
        const gamePath = currentGame()
        if (await isGameRunning()) {
          throw new Error('Cyberpunk 2077 is already running.')
        }
        if (!(await isGameFolder(gamePath))) {
          throw new Error(`Cyberpunk2077.exe was not found in "${gamePath}".`)
        }

        const statuses = await deployStatuses(deployContext(gamePath))
        const ours = redModFolders(library.list(), (id) => statuses.get(id) === 'deployed')
        const args = await prepareRedMods(gamePath, ours, (exe, redModArgs) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IpcChannels.launchCompiling)
          }
          return runRedMod(exe, redModArgs)
        })

        const env = await readLaunchEnvironment(gamePath)
        logger.info(`Launching the game ${[...args, ...Object.keys(env)].join(' ')}`.trim())
        await launchExe(gameExe(gamePath), args, env)

        return null
      })
    )
  )

  ipcMain.handle(IpcChannels.detectGames, (): Promise<DetectedGame[]> => detectGames())

  ipcMain.handle(IpcChannels.selectGame, (_event, path: unknown): Promise<Result<Settings>> => {
    if (typeof path !== 'string') throw new Error('selectGame: path must be a string')
    return setGamePath(path)
  })

  ipcMain.handle(IpcChannels.browseGame, async (event): Promise<Result<Settings> | null> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Select your Cyberpunk 2077 folder',
      properties: ['openDirectory']
    })
    if (canceled) return null

    return setGamePath(filePaths[0])
  })

  ipcMain.handle(IpcChannels.listMods, (): ModRecord[] => library.list())

  ipcMain.handle(IpcChannels.pickArchives, async (event): Promise<string[] | null> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Import mod archives',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Mod archives', extensions: ARCHIVE_EXTENSIONS.map((ext) => ext.slice(1)) }]
    })
    return canceled ? null : filePaths
  })

  ipcMain.handle(IpcChannels.importMod, (_event, path: unknown): Promise<Result<ImportOutcome>> =>
    runImport(() =>
      toResult(async () => {
        const archive = await checkArchivePath(path)
        const outcome = await importMod(
          { sevenZip: paths.sevenZip, modsDir: modsDir(), library },
          archive
        )

        if (outcome.kind === 'imported') {
          nexus.refreshInBackground()
        }

        return outcome
      })
    )
  )

  ipcMain.handle(IpcChannels.getInstalledDependencies, (): Promise<Dependency[]> => {
    const { gamePath } = settings.get()
    return gamePath ? detectInstalled(gamePath) : Promise.resolve([])
  })

  ipcMain.handle(IpcChannels.listDeployments, async (): Promise<Record<string, DeployStatus>> => {
    const statuses: Record<string, DeployStatus> = {}
    const { gamePath } = settings.get()
    if (!gamePath) return {}
    for (const manifest of await games.forGame(gamePath).list()) {
      statuses[manifest.modId] = manifest.status
    }
    return statuses
  })

  ipcMain.handle(IpcChannels.deployMod, (_event, modId: unknown): Promise<Result<string[]>> =>
    runExclusive(() =>
      toResult(async () => {
        await refuseWhileGameRuns()
        const gamePath = currentGame()
        await refuseWhileBisecting(gamePath)
        const mod = findMod(modId)
        const context = deployContext(gamePath)

        const requirements = settings.get().autoDeployRequirements
          ? requirementsToDeploy(mod, {
              library: library.list(),
              installed: await detectInstalled(gamePath),
              deployments: Object.fromEntries(await deployStatuses(context)),
              nexus: nexus.requirements()
            })
          : []

        const groups = versionGroups(library.list(), nexus.files())
        return deployWithRequirements(mod, requirements, (target) =>
          deployVersion(context, gamePath, target, groups)
        )
      })
    )
  )

  ipcMain.handle(
    IpcChannels.undeployMod,
    (_event, modId: unknown): Promise<Result<UndeployResult>> =>
      runExclusive(() =>
        toResult(async () => {
          await refuseWhileGameRuns()
          const gamePath = currentGame()
          await refuseWhileBisecting(gamePath)

          return undeployMod(deployContext(currentGame()), findMod(modId))
        })
      )
  )

  ipcMain.handle(
    IpcChannels.removeMod,
    (
      _event,
      modId: unknown,
      trashLeftovers: unknown,
      allVersions: unknown
    ): Promise<Result<UndeployResult>> =>
      runExclusive(() =>
        toResult(async () => {
          await refuseWhileGameRuns()
          const gamePath = currentGame()
          await refuseWhileBisecting(gamePath)
          const context = deployContext(gamePath)
          const mod = findMod(modId)
          const { removed, deployedInstead } = await removeVersions(
            context,
            gamePath,
            mod,
            otherVersionsOf(mod),
            allVersions === true
          )

          let cleaned: CleanResult | undefined
          for (const { deployed, folders, kept } of removed) {
            if (trashLeftovers !== true || !deployed) continue
            cleaned = await cleanModLeftovers(
              context.manifests,
              gamePath,
              { folders, kept },
              (file) => shell.trashItem(file)
            )
          }

          return {
            kept: removed.flatMap(({ kept }) => kept),
            cleaned,
            deployedInstead: deployedInstead?.name
          }
        })
      )
  )

  ipcMain.handle(IpcChannels.revealMod, (_event, modId: unknown): Promise<Result<null>> =>
    toResult(async () => {
      const folder = stagingFolderFor(modsDir(), findMod(modId))

      if (!(await stat(folder)).isDirectory()) throw new Error('The mod folder is missing.')
      const error = await shell.openPath(folder)
      if (error) throw new Error(error)
      return null
    })
  )

  ipcMain.handle(IpcChannels.openNexusPage, (_event, modId: unknown): Promise<Result<null>> =>
    toResult(async () => {
      await shell.openExternal(nexusPageOf(modId))

      return null
    })
  )

  ipcMain.handle(IpcChannels.openNexusFiles, (_event, modId: unknown): Promise<Result<null>> =>
    toResult(async () => {
      await shell.openExternal(`${nexusPageOf(modId)}?tab=files`)

      return null
    })
  )

  ipcMain.handle(
    IpcChannels.setVersionOf,
    (_event, modId: unknown, targetId: unknown): Promise<Result<null>> =>
      runExclusive(() =>
        toResult(async () => {
          const mod = findMod(modId)
          const target = targetId === null ? null : findMod(targetId)
          const mods = library.list()
          const { gamePath } = settings.get()
          const statuses = gamePath ? await deployStatuses(deployContext(gamePath)) : new Map()

          checkVersionLink(mod, target, mods, versionGroups(mods, nexus.files()), (id) =>
            statuses.has(id)
          )
          await library.setVersionOf(mod.id, target?.id ?? null)

          return null
        })
      )
  )

  ipcMain.handle(IpcChannels.runBulk, (_event, request: unknown): Promise<Result<BulkResult>> =>
    runExclusive(() =>
      toResult(async () => {
        await refuseWhileGameRuns()
        if (!isBulkRequest(request)) throw new Error('Unknown bulk action.')

        const gamePath = currentGame()
        await refuseWhileBisecting(gamePath)

        const context = deployContext(gamePath)

        const { action, scope, trashLeftovers } = request
        if (action === 'deploy') {
          return deployAll(context, gamePath, scope, versionGroups(library.list(), nexus.files()))
        }

        const result =
          action === 'purge' ? await purgeAll(context, scope) : await removeAll(context, scope)
        if (!trashLeftovers) {
          return result
        }

        const cleaned = await cleanUnusedLeftovers(context.manifests, gamePath, (file) =>
          shell.trashItem(file)
        )

        return { ...result, cleaned }
      })
    )
  )

  ipcMain.handle(IpcChannels.getModsFolder, (): ModsFolderInfo => {
    const { gamePath } = settings.get()
    const path = modsDir()
    return { path, sameDriveAsGame: gamePath ? sameDrive(path, gamePath) : null }
  })

  ipcMain.handle(IpcChannels.changeModsFolder, async (event): Promise<Result<Settings> | null> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Choose a folder for your mods',
      properties: ['openDirectory']
    })

    if (canceled) return null

    return runImport(() =>
      runExclusive(() =>
        toResult(async () => {
          const deployedIn = await games.deployedGames()
          if (deployedIn.length > 0) {
            throw new Error(
              `Purge all mods first. Mods are still deployed in ${deployedIn.join(', ')}.`
            )
          }

          const from = modsDir()
          const to = win32.resolve(filePaths[0])
          await checkNewModsFolder(to, from, settings.get().gamePath)

          let updated = settings.get()
          await moveMods(from, to, library.list(), async () => {
            updated = await settings.update({ modsPath: to })
          })

          return updated
        })
      )
    )
  })

  ipcMain.handle(IpcChannels.scanLeftovers, (): Promise<Result<LeftoverGroup[]>> =>
    runExclusive(() =>
      toResult(async () => {
        const gamePath = currentGame()
        return scanLeftovers(games.forGame(gamePath), gamePath)
      })
    )
  )

  ipcMain.handle(
    IpcChannels.cleanLeftovers,
    (_event, paths: unknown): Promise<Result<CleanResult>> =>
      runExclusive(() =>
        toResult(async () => {
          if (!isStringArray(paths)) throw new Error('Invalid file list.')

          await refuseWhileGameRuns()
          const gamePath = currentGame()
          await refuseWhileBisecting(gamePath)

          return cleanLeftovers(games.forGame(gamePath), gamePath, paths, (file) =>
            shell.trashItem(file)
          )
        })
      )
  )

  ipcMain.handle(IpcChannels.getBisect, (): Promise<Result<BisectView | null>> =>
    runExclusive(() =>
      toResult(async () => {
        const { gamePath } = settings.get()
        return gamePath ? getBisect(deployContext(gamePath)) : null
      })
    )
  )

  ipcMain.handle(
    IpcChannels.startBisect,
    (_event, suspects: unknown, checkFirst: unknown): Promise<Result<BisectView>> =>
      bisectTask(async (context, gamePath) => {
        if (!isStringArray(suspects) || typeof checkFirst !== 'boolean') {
          throw new Error('Invalid bisect request.')
        }
        return beginBisect(context, gamePath, suspects, checkFirst)
      })
  )

  ipcMain.handle(IpcChannels.answerBisect, (_event, answer: unknown): Promise<Result<BisectView>> =>
    bisectTask(async (context, gamePath) => {
      if (answer !== 'broken' && answer !== 'works') {
        throw new Error('Unknown ansewr.')
      }

      return answerRound(context, gamePath, answer)
    })
  )

  ipcMain.handle(IpcChannels.undoBisect, (): Promise<Result<BisectView>> =>
    bisectTask((context, gamePath) => undoRound(context, gamePath))
  )

  ipcMain.handle(IpcChannels.applyBisect, (): Promise<Result<BisectView>> =>
    bisectTask((context, gamePath) => applyRound(context, gamePath))
  )

  ipcMain.handle(IpcChannels.endBisect, (_event, keepCulpritOff: unknown): Promise<Result<null>> =>
    bisectTask(async (context, gamePath) => {
      if (typeof keepCulpritOff !== 'boolean') {
        throw new Error('Invalid bisect request.')
      }
      await endBisect(context, gamePath, keepCulpritOff)

      return null
    })
  )

  ipcMain.handle(IpcChannels.getNexusRequirements, (): Record<number, NexusRequirement[]> =>
    nexus.requirements()
  )

  ipcMain.handle(IpcChannels.getModUpdates, (): Record<string, ModUpdate> => nexus.updates())

  ipcMain.handle(IpcChannels.getVersionGroups, (): VersionGroup[] =>
    versionGroups(library.list(), nexus.files())
  )

  ipcMain.handle(IpcChannels.listLogs, (): Promise<Result<GameLogs>> =>
    toResult(() => scanLogs(currentGame(), crashReportsDir()))
  )

  ipcMain.handle(IpcChannels.openLog, (_event, path: unknown): Promise<Result<null>> =>
    toResult(async () => openInShell(await findLog(currentGame(), path)))
  )

  ipcMain.handle(IpcChannels.openLogFolder, (_event, path: unknown): Promise<Result<null>> =>
    toResult(async () => openInShell(win32.dirname(await findLog(currentGame(), path))))
  )

  ipcMain.handle(IpcChannels.openCrashReports, (): Promise<Result<null>> =>
    toResult(async () => openInShell(await checkCrashReports(crashReportsDir())))
  )
}

function isBulkRequest(value: unknown): value is BulkRequest {
  if (typeof value !== 'object' || value === null) return false
  const { action, scope, trashLeftovers } = value as Record<string, unknown>

  return (
    (action === 'deploy' || action === 'purge' || action === 'remove') &&
    (scope === 'all' || scope === 'core' || scope === 'non-core') &&
    (trashLeftovers === undefined || typeof trashLeftovers === 'boolean')
  )
}

async function refuseWhileGameRuns(): Promise<void> {
  if (await isGameRunning()) {
    throw new Error('Cyberpunk 2077 is running. Close your game first, then try again.')
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function crashReportsDir(): string {
  const localAppData = process.env.LOCALAPPDATA ?? join(app.getPath('home'), 'AppData', 'Local')
  return join(localAppData, 'REDEngine', 'ReportQueue')
}

async function openInShell(path: string): Promise<null> {
  const error = await shell.openPath(path)
  if (error) {
    throw new Error(error)
  }

  return null
}
