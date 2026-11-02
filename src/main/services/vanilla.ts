const VANILLA_FOLDERS = [
  'archive',
  'archive/pc',
  'archive/pc/mod',
  'bin',
  'bin/x64',
  'engine',
  'mods',
  'r6',
  'r6/config'
]

const VANILLA_TREES = [
  'archive/pc/content',
  'archive/pc/ep1',
  'bin/x64/CrashReporter',
  'bin/x64/D3D12',
  'bin/x64/d3d12on7',
  'engine/config',
  'r6/cache',
  'r6/config/settings',
  'r6/publishing',
  'tools'
].map((tree) => tree.toLowerCase())

const FOLDERS = new Set(VANILLA_FOLDERS.map((folder) => folder.toLowerCase()))

export function isVanillaFolder(folder: string): boolean {
  const key = folder.toLowerCase()
  return (
    FOLDERS.has(key) || VANILLA_TREES.some((tree) => key === tree || key.startsWith(`${tree}/`))
  )
}
