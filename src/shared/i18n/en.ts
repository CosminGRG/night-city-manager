import type { Message } from './messages'

// The English text of every message, grouped by screen.
export const EN = {
  // Shared
  'common.cancel': 'Cancel',
  'common.change': 'Change',
  'common.save': 'Save',
  'common.remove': 'Remove',
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
  'mods.title': 'Mods',
  'mods.active': { other: '{count} active' },
  'mods.activeTitle': 'Deployed to your game folder',
  'mods.interrupted': { other: '{count} interrupted' },
  'mods.interruptedTitle': 'A deploy or undeploy was interrupted. Undeploy these mods to clean up.',
  'mods.import': 'Import archives',
  'mods.bisecting': "A bisect is running, so mods can't be changed until you finish or stop it.",
  'mods.openTroubleshoot': 'Open Troubleshoot',
  'mods.empty': 'No mods yet',
  'mods.emptyHint': 'Drag mod archives anywhere into the window, or pick them from your disk.',
  'mods.noMatch': 'No mods match "{query}"',
  'mods.clearSearch': 'Clear search',
  'mods.search': 'Search mods',
  'mods.searchPlaceholder': 'Search mods (Ctrl+F)',
  'mods.column.name': 'Name',
  'mods.column.version': 'Ver.',
  'mods.column.type': 'Type',
  'mods.column.requires': 'Requires',
  'mods.column.imported': 'Imported',
  'mods.range': '{first}–{last} of {total}',
  'mods.pages': 'Pages',
  'mods.previousPage': 'Previous page',
  'mods.nextPage': 'Next page',
  'mods.status.deployed': 'Deployed',
  'mods.status.interrupted': 'Interrupted',
  'mods.status.idle': 'Not deployed',
  'mods.interruptedWarning': 'The last deploy or undeploy was interrupted. Undeploy to clean up.',
  'mods.core': 'Core',
  'mods.coreTitle': 'Core mod: {frameworks}',
  'mods.busy.deploying': 'Deploying...',
  'mods.busy.switching': 'Switching...',
  'mods.busy.undeploying': 'Undeploying...',
  'mods.busy.removing': 'Removing...',
  'mods.busy.purging': 'Purging...',
  'mods.switchLabel': 'Deploy {name}',
  'mods.switch.deployed': 'Deployed. Click to undeploy.',
  'mods.switch.interrupted': 'Interrupted. Click to clean up.',
  'mods.switch.nothing': 'This mod has no files that can be placed automatically',
  'mods.switch.idle': 'Not deployed. Click to deploy.',
  'mods.moreActions': 'More actions for {name}',
  'mods.menu.reveal': 'Reveal in Explorer',
  'mods.menu.nexusPage': 'Open Nexus page',
  'mods.menu.nexusFiles': 'View files on Nexus',
  'mods.menu.linkVersion': 'Set as version of...',
  'mods.menu.remove': 'Remove',
  'mods.actionsButton': 'Actions',
  'mods.actions.deployAll': 'Deploy all ({count})',
  'mods.actions.deployCore': 'Deploy core mods ({count})',
  'mods.actions.purgeAll': 'Purge all ({count})',
  'mods.actions.purgeNonCore': 'Purge all but core mods ({count})',
  'mods.actions.removeAll': 'Remove all ({count})',
  'mods.actions.removeNonCore': 'Remove all but core mods ({count})',
  'mods.version.label': { other: 'Version {version} of {name}, {count} versions' },
  'mods.version.switchTo': 'Switch to version',
  'mods.version.show': 'version',
  'mods.version.newest': 'newest',
  'mods.coreStrip': 'Core mods',
  'mods.coreInstalled': 'Installed in the game folder',
  'mods.coreMissing': 'Not installed in the game folder',
  'updates.available': 'Update available',
  'updates.title':
    'Update available: {version} ("{name}"), uploaded {day}. Click to see its files on Nexus Mods.',
  'requirements.installed': '{label} is installed.',
  'requirements.deployed': '{label} is deployed.',
  'requirements.inLibrary': '{label} is in your library ({provider}) but not deployed.',
  'requirements.missingNexus': '{label} is not installed. Get it on Nexus Mods.',
  'requirements.missingStore': '{label} is not installed. It is free in your game store.',
  'requirements.notInLibrary': '{label} is not in your library. Get it on Nexus Mods.',
  'requirements.optional': 'Optional: {title}',
  'requirements.optionalBadge': '{label} (optional)',
  'requirements.state.met': 'installed',
  'requirements.state.notDeployed': 'not deployed',
  'requirements.state.missing': 'not installed',
  'requirements.more': 'more: {titles}',
  'requirements.notDeployedLabel': '{label} (in your library, not deployed)',
  'requirements.stillNeeds': '{name} is deployed, but it still needs: {labels}.',
  'requirements.alsoDeployed': 'Also deployed what {name} needs: {names}.',
  'requirements.brokenBy': {
    one: '{names} still needs {name} and may not work without it.',
    other: '{names} still need {name} and may not work without it.'
  },
  'mods.deployedInstead': '{name} is deployed in its place.',
  'mods.keptAll':
    '{name}: none of its files could be verified, so all were left in place (was its folder in "mods" deleted?): {files}',
  'mods.keptChanged': '{name}: left in place because they changed after deploy: {files}',
  'mods.linked': '{name} is now a version of {target}.',
  'mods.unlinked': '{name} is a separate mod.',
  'mods.bulk.deployed': { one: 'Deployed {count} mod.', other: 'Deployed {count} mods.' },
  'mods.bulk.purged': { one: 'Purged {count} mod.', other: 'Purged {count} mods.' },
  'mods.bulk.removed': { one: 'Removed {count} mod.', other: 'Removed {count} mods.' },
  'mods.bulk.skipped': {
    other:
      "Skipped {count} that can't be deployed automatically (nothing to place, or an interrupted deploy that needs an undeploy first)."
  },
  'mods.bulk.kept': 'Left in place because they changed after deploy: {files}',
  'mods.bulk.failed': 'Failed: {mods}',
  'bulk.scope.all': 'all mods',
  'bulk.scope.core': 'core mods',
  'bulk.scope.nonCore': 'all but core mods',
  'bulk.deploy.title': 'Deploy {target}?',
  'bulk.deploy.body': {
    one: '{count} mod will be deployed to your game folder, core mods first.',
    other: '{count} mods will be deployed to your game folder, core mods first.'
  },
  'bulk.deploy.note':
    'If two mods want the same file, the first one keeps it and the other is reported.',
  'bulk.deploy.confirm': 'Deploy',
  'bulk.purge.title': 'Purge {target}?',
  'bulk.purge.body': {
    one: '{count} deployed mod will be taken out of your game folder.',
    other: '{count} deployed mods will be taken out of your game folder.'
  },
  'bulk.purge.note': 'They stay in your mod list, so you can deploy them again anytime.',
  'bulk.purge.confirm': 'Purge',
  'bulk.remove.title': 'Remove {target}?',
  'bulk.remove.body': {
    one: '{count} mod will be undeployed and deleted from your mod list.',
    other: '{count} mods will be undeployed and deleted from your mod list.'
  },
  'bulk.remove.note':
    'Your downloaded archives stay where they are, but every mod has to be imported again.',
  'bulk.missing': {
    one: "{count} mod needs something that isn't installed",
    other: "{count} mods need something that isn't installed"
  },
  'bulk.showMods': 'Show mods',
  'bulk.missingNote': 'They will deploy but may not work until you add these.',
  'bulk.trashHint':
    'Logs, settings and saved data (like CET key bindings or AMM appearances) in folders the app created that no deployed mod still uses.',
  'bulk.confirmWord': 'remove',
  'bulk.typeToConfirm': 'Type {word} to confirm',
  'remove.title': 'Remove {name}?',
  'remove.titleAll': 'Remove all versions of {name}?',
  'remove.body.one': 'It will be taken off your mod list.',
  'remove.body.oneDeployed': 'It will be taken off your mod list and out of your game.',
  'remove.body.all': 'They will be taken off your mod list.',
  'remove.body.allDeployed': 'They will be taken off your mod list and out of your game.',
  'remove.archiveNote':
    'Your downloaded archive stays where it is, so you can import it again anytime.',
  'remove.otherVersions': {
    one: 'Also remove the other version',
    other: 'Also remove the other versions'
  },
  'remove.trashHint':
    'Settings, logs and saved mod data written into the folders it created in the game.',

  // Troubleshoot
  'leftovers.moved': {
    one: 'Moved {count} leftover file to the Recycle Bin.',
    other: 'Moved {count} leftover files to the Recycle Bin.'
  },
  'leftovers.notMoved': 'Could not move: {files}',
  'leftovers.trashOption': 'Also move leftover files to the Recycle Bin'
} satisfies Record<string, Message>

export type MessageKey = keyof typeof EN

export const MESSAGE_KEYS = Object.keys(EN) as MessageKey[]
