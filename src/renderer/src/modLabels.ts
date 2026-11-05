import type { Framework, ModType } from '@shared/types'

export const MOD_TYPE_LABELS: Record<ModType, string> = {
  archive: 'Archive',
  archivexl: 'ArchiveXL',
  redmod: 'REDmod',
  cet: 'CET',
  red4ext: 'RED4ext',
  redscript: 'Redscript',
  tweakxl: 'TweakXL',
  input: 'Input Loader',
  config: 'Config'
}

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  cet: 'Cyber Engine Tweaks',
  red4ext: 'RED4ext',
  redscript: 'redscript',
  archivexl: 'ArchiveXL',
  tweakxl: 'TweakXL',
  codeware: 'Codeware'
}
