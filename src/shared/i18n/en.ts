import type { Message } from './messages'

// The English text of every message, grouped by screen.
export const EN = {
  // Shared
  'common.cancel': 'Cancel',
  'common.change': 'Change',
  'common.save': 'Save',
  'app.loading': 'Loading...',

  // Sidebar
  'nav.mods': 'Mod list',
  'nav.import': 'Import',
  'nav.troubleshoot': 'Troubleshoot',
  'nav.settings': 'Settings',
  'launch.idle': 'Launch Cyberpunk 2077',
  'launch.starting': 'Starting Cyberpunk 2077...',
  'launch.compiling': 'Compiling REDmod mods...',
  'launch.compilingHint': 'Compiling REDmod mods... This can take some time after you change them.',

  // First start
  'setup.title': 'Welcome to Fixer',
  'setup.intro': 'First, select where Cyberpunk 2077 is installed.',
  'setup.searching': 'Looking for your game...',
  'setup.notFound': "We couldn't find it automatically.",
  'setup.found': 'We found your game. Pick it to continue:',
  'setup.useThis': 'Use this',
  'setup.browse': 'Browse for the game folder',
  'setup.browseOther': 'Use a different folder',

  // Settings
  'settings.gameFolder.title': 'Game folder',
  'settings.gameFolder.hint':
    'Each game folder keeps its own deployed mods. Switching back shows them again.',
  'settings.modsFolder.title': 'Mods folder',
  'settings.modsFolder.moving': 'Moving mods...',
  'settings.modsFolder.sameDrive':
    'Same drive as the game, deploys using hard links, which are instant and take no space.',
  'settings.modsFolder.otherDrive':
    "This folder is on a different drive than the game. The manager will work, but every deploy copies the files. Choose an empty folder on the game's drive for instant deploys.",
  'settings.modsFolder.hint': 'Changing it moves all your mods there. Purge all mods first.',
  'settings.deploying.title': 'Deploying',
  'settings.deploying.autoRequirements': 'Deploy requirements automatically',
  'settings.deploying.autoRequirementsHint':
    'When you switch a mod on, the mods it needs that are in your library are deployed first. Optional requirements are left alone.',
  'settings.nexus.lookup': 'Look up mod info on Nexus Mods',
  'settings.nexus.lookupHint': 'Finds out what your mods need from their Nexus pages.',
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
    'Saved the English template to {path}. Translate the texts, then share the file.',
  'settings.about.title': 'About',
  'settings.about.version': 'Fixer {version} by Cosmin G. · Electron {electron}',
  'settings.about.dataFolder': 'Data folder:',
  'settings.about.licenses':
    'Fonts: Inter by The Inter Project Authors and Rajdhani by Indian Type Foundry, under the SIL Open Font License 1.1. Fixer is free software under the GNU GPL, version 3 or later.',

  // Import
  'import.dropHere': 'Drop to import',
  'import.title': 'Import mods',
  'import.dropTitle': 'Drag mod archives anywhere into the window',
  'import.choose': 'Choose archives',
  'import.getMore': 'Get more mods on Nexus Mods',
  'import.clearFinished': 'Clear finished',
  'import.empty': 'Archives you import will show up here.',
  'import.noneYet': 'No imports yet',
  'import.progress': 'Importing {current} of {total}...',
  'import.summary.imported': { other: '{count} imported' },
  'import.summary.duplicate': { other: '{count} already in your library' },
  'import.summary.failed': { other: '{count} failed' },
  'import.status.queued': 'Waiting',
  'import.status.importing': 'Importing',
  'import.status.done': 'Imported',
  'import.status.duplicate': 'Already in your library',
  'import.status.failed': 'Failed',
  'import.duplicateOf': 'Already in your library as "{name}"',
  'import.question': "Its name doesn't say which mod it is. Is it a new version of a mod you have?",
  'import.answer': 'Choose...',
  'import.versionOf': 'Version of {name}',
  'import.separate': 'Separate mod',
  'versionLink.title': 'Is {name} a version of another mod?',
  'versionLink.intro':
    "Its archive name doesn't follow the Nexus Mods format, so Fixer can't tell. If it's a version of a mod you have, pick that mod.",
  'versionLink.search': 'Search your mods',
  'versionLink.legend': 'Version of',
  'versionLink.separate': "It's a separate mod",

  // Mod list
  'mods.deployedInstead': '{name} is deployed in its place.',

  // Troubleshoot
  'leftovers.moved': {
    one: 'Moved {count} leftover file to the Recycle Bin.',
    other: 'Moved {count} leftover files to the Recycle Bin.'
  }
} satisfies Record<string, Message>

export type MessageKey = keyof typeof EN

export const MESSAGE_KEYS = Object.keys(EN) as MessageKey[]
