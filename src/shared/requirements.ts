import type { Framework, InstallPlan, ModRecord, ModType } from './types'

export type Dependency =
  | Framework
  | 'inputloader'
  | 'appearanceruntime'
  | 'nativesettings'
  | 'radioext'
  | 'amm'
  | 'modsettings'
  | 'virtualatelier'
  | 'redmod'

export interface KnownDependency {
  label: string
  file: string
  nexusId: number | null
  addons?: string
}

export const KNOWN_DEPENDENCIES: Record<Dependency, KnownDependency> = {
  cet: {
    label: 'Cyber Engine Tweaks',
    file: 'bin/x64/plugins/cyber_engine_tweaks.asi',
    nexusId: 107
  },
  red4ext: { label: 'RED4ext', file: 'red4ext/red4ext.dll', nexusId: 2380 },
  redscript: { label: 'redscript', file: 'engine/tools/scc.exe', nexusId: 1511 },
  archivexl: {
    label: 'ArchiveXL',
    file: 'red4ext/plugins/archivexl/archivexl.dll',
    nexusId: 4198
  },
  tweakxl: { label: 'TweakXL', file: 'red4ext/plugins/tweakxl/tweakxl.dll', nexusId: 4197 },
  codeware: { label: 'Codeware', file: 'red4ext/plugins/codeware/codeware.dll', nexusId: 7780 },
  inputloader: {
    label: 'Input Loader',
    file: 'red4ext/plugins/input_loader/input_loader.dll',
    nexusId: 4575
  },
  appearanceruntime: {
    label: 'Appearance Runtime Plugin',
    file: 'red4ext/plugins/appearanceruntimeplugin/appearanceruntimeplugin.dll',
    nexusId: 35126
  },
  nativesettings: {
    label: 'Native Settings UI',
    file: 'bin/x64/plugins/cyber_engine_tweaks/mods/nativesettings/init.lua',
    nexusId: 3518
  },
  radioext: {
    label: 'RadioExt',
    file: 'bin/x64/plugins/cyber_engine_tweaks/mods/radioext/init.lua',
    nexusId: 4591,
    addons: 'bin/x64/plugins/cyber_engine_tweaks/mods/radioext/'
  },
  amm: {
    label: 'Appearance Menu Mod',
    file: 'bin/x64/plugins/cyber_engine_tweaks/mods/appearancemenumod/init.lua',
    nexusId: 790,
    addons: 'bin/x64/plugins/cyber_engine_tweaks/mods/appearancemenumod/'
  },
  redmod: { label: 'REDmod DLC', file: 'tools/redmod/bin/redmod.exe', nexusId: null },
  modsettings: {
    label: 'Mod Settings',
    file: '/red4ext/plugins/mod_settings/mod_settings.dll',
    nexusId: 4885
  },
  virtualatelier: {
    label: 'Virtual Atelier',
    file: 'r6/scripts/virtual-atelier-full/config.reds',
    nexusId: 2987
  }
}

export const DEPENDENCIES = Object.keys(KNOWN_DEPENDENCIES) as Dependency[]

const NEEDS: Record<ModType, Dependency[]> = {
  archive: [],
  archivexl: ['archivexl'],
  redmod: ['redmod'],
  cet: ['cet'],
  red4ext: ['red4ext'],
  redscript: ['redscript'],
  tweakxl: ['tweakxl'],
  input: ['inputloader'],
  config: []
}

function targetsOf(plan: InstallPlan): string[] {
  return plan.files.map((file) => file.target.toLowerCase())
}

export function provides(plan: InstallPlan): Dependency[] {
  const targets = new Set(targetsOf(plan))
  return DEPENDENCIES.filter((dependency) => targets.has(KNOWN_DEPENDENCIES[dependency].file))
}

function addonOf(targets: string[]): Dependency[] {
  return DEPENDENCIES.filter((dependency) => {
    const folder = KNOWN_DEPENDENCIES[dependency].addons
    return folder !== undefined && targets.some((target) => target.startsWith(folder))
  })
}

export function needs(plan: InstallPlan): Dependency[] {
  const own = provides(plan)
  const needed = new Set([
    ...plan.types.flatMap((type) => NEEDS[type]),
    ...addonOf(targetsOf(plan))
  ])
  return [...needed].filter((dependency) => !own.includes(dependency))
}

export interface UnmetRequirement {
  dependency: Dependency
  provider: ModRecord | null
}

export function unmetRequirements(
  mod: ModRecord,
  library: ModRecord[],
  installed: Dependency[]
): UnmetRequirement[] {
  return needs(mod.plan)
    .filter((dependency) => !installed.includes(dependency))
    .map((dependency) => ({
      dependency,
      provider: library.find((other) => provides(other.plan).includes(dependency)) ?? null
    }))
}
