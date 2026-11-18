import type { Message } from './messages'

//The English text of every message
export const EN = {
  'nav.mods': 'Mod list',
  'nav.import': 'Import',
  'nav.troubleshoot': 'Troubleshoot',
  'nav.settings': 'Settings',
  'mods.deployedInstead': '{name} is deployed in its place.',
  'leftovers.moved': {
    one: 'Moved {count} leftover file to the Recycle Bin.',
    other: 'Moved {count} leftover files to the Recycle Bin.'
  }
} satisfies Record<string, Message>

export type MessageKey = keyof typeof EN

export const MESSAGE_KEYS = Object.keys(EN) as MessageKey[]
