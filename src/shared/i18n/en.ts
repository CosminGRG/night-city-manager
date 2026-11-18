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
  },
  'settings.language.title': 'Language',
  'settings.language.option': '{name} · {percent}% · by {author}',
  'settings.language.optionNoAuthor': '{name} · {percent}%',
  'settings.language.missing': '{file} (not found, showing English)',
  'settings.language.hint':
    'Get a translation from Nexus Mods and add it here, or copy its file into the languages folder.',
  'settings.language.add': 'Add language...',
  'settings.language.openFolder': 'Open languages folder',
  'settings.language.saveTemplate': 'Save translation template...',
  'settings.language.added': {
    one: 'Added {names}.',
    other: 'Added {count} languages: {names}.'
  },
  'settings.language.templateSaved':
    'Saved the English template to {path}. Translate the texts, then share the file.'
} satisfies Record<string, Message>

export type MessageKey = keyof typeof EN

export const MESSAGE_KEYS = Object.keys(EN) as MessageKey[]
