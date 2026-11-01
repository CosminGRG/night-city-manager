import { app, ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { stat } from 'fs/promises'
import { join } from 'path'
import { IpcChannels, type AppInfo } from '@shared/ipc'
import type {
  DetectedGame,
  Settings,
  Result,
  ModRecord,
  Framework,
  DeployStatus,
  UndeployResult
} from '@shared/types'
import type { SettingsStore } from './services/settings'
import { detectGames, findGameRoot } from './services/gameDetector'
import type { ModLibrary } from './services/modLibrary'
import type { AppPaths } from './services/paths'
import { importMod } from './services/importer'
import { detectInstalledFrameworks } from './services/frameworks'
import type { ManifestStore } from './services/manifests'
import { createQueue } from './services/queue'
import { type DeployContext, deployMod, undeployMod } from './services/deployer'
import { ARCHIVE_EXTENSIONS, checkArchivePath } from './services/archivePath'
import { removeMod } from './services/removal'
import { stagingFolderFor } from './services/staging'

interface IpcDependencies {
  settings: SettingsStore
  library: ModLibrary
  paths: AppPaths
  manifests: ManifestStore
}

export function registerIpcHandlers({
  settings,
  library,
  paths,
  manifests
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

  function deployContext(): DeployContext {
    return {
      modsDir: settings.get().modsPath ?? paths.mods,
      backupsDir: join(paths.data, 'backups'),
      manifests,
      library
    }
  }

  async function toResult<T>(task: () => Promise<T>): Promise<Result<T>> {
    try {
      return { ok: true, value: await task() }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  ipcMain.handle(IpcChannels.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    userDataPath: app.getPath('userData')
  }))

  ipcMain.handle(IpcChannels.getSettings, (): Settings => settings.get())

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

  ipcMain.handle(IpcChannels.importMod, (_event, path: unknown): Promise<Result<ModRecord>> =>
    runImport(() =>
      toResult(async () => {
        const archive = await checkArchivePath(path)
        const modsDir = settings.get().modsPath ?? paths.mods
        return importMod({ sevenZip: paths.sevenZip, modsDir, library }, archive)
      })
    )
  )

  ipcMain.handle(IpcChannels.getInstalledFrameworks, (): Promise<Framework[]> => {
    const { gamePath } = settings.get()
    return gamePath ? detectInstalledFrameworks(gamePath) : Promise.resolve([])
  })

  ipcMain.handle(IpcChannels.listDeployments, async (): Promise<Record<string, DeployStatus>> => {
    const statuses: Record<string, DeployStatus> = {}
    for (const manifest of await manifests.list()) {
      statuses[manifest.modId] = manifest.status
    }
    return statuses
  })

  ipcMain.handle(IpcChannels.deployMod, (_event, modId: unknown): Promise<Result<null>> =>
    runExclusive(() =>
      toResult(async () => {
        const { gamePath } = settings.get()
        if (!gamePath) throw new Error('Choose your game folder first.')
        await deployMod(deployContext(), gamePath, findMod(modId))
        return null
      })
    )
  )

  ipcMain.handle(
    IpcChannels.undeployMod,
    (_event, modId: unknown): Promise<Result<UndeployResult>> =>
      runExclusive(() => toResult(() => undeployMod(deployContext(), findMod(modId))))
  )

  ipcMain.handle(IpcChannels.removeMod, (_event, modId: unknown): Promise<Result<UndeployResult>> =>
    runExclusive(() =>
      toResult(async () => {
        const mod = findMod(modId)
        const deployed = (await manifests.read(mod.id)) !== null
        const result = deployed ? await undeployMod(deployContext(), mod) : { kept: [] }
        await removeMod(deployContext(), mod)
        return result
      })
    )
  )

  ipcMain.handle(IpcChannels.revealMod, (_event, modId: unknown): Promise<Result<null>> =>
    toResult(async () => {
      const folder = stagingFolderFor(deployContext().modsDir, findMod(modId))
      if (!(await stat(folder)).isDirectory()) throw new Error('The mod folder is missing.')
      const error = await shell.openPath(folder)
      if (error) throw new Error(error)
      return null
    })
  )

  ipcMain.handle(IpcChannels.openNexusPage, (_event, modId: unknown): Promise<Result<null>> =>
    toResult(async () => {
      const { nexusModId } = findMod(modId)
      if (!Number.isSafeInteger(nexusModId) || nexusModId === null || nexusModId <= 0) {
        throw new Error('This mod has no Nexus page.')
      }
      await shell.openExternal(`https://www.nexusmods.com/cyberpunk2077/mods/${nexusModId}`)
      return null
    })
  )
}
