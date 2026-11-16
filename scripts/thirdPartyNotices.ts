import { readdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import type { Plugin } from 'vite'

const FILE_NAME = 'THIRD-PARTY-NOTICES.txt'
const REPOSITORY = 'https://github.com/CosminGRG/night-city-manager'

// The folder of the npm package a bundled file came from (the last node_modules wins for nested ones).
const PACKAGE_DIR = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/
const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i

interface PackageNotice {
  name: string
  version: string
  license: string
  text: string
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
}

function readNotice(dir: string): PackageNotice {
  const pkg = readJson(join(dir, 'package.json'))
  const name = String(pkg.name)
  const file = readdirSync(dir).find((entry) => LICENSE_FILE.test(entry))
  const author = typeof pkg.author === 'string' ? ` Author: ${pkg.author}.` : ''

  return {
    name,
    version: String(pkg.version),
    license: typeof pkg.license === 'string' ? pkg.license : 'unknown',
    text: file
      ? readFileSync(join(dir, file), 'utf8').trim()
      : `The package ships no license file.${author} See https://www.npmjs.com/package/${name}`
  }
}

function render(notices: PackageNotice[]): string {
  const header = [
    'Fixer is free software, licensed under GPL-3.0-or-later (see LICENSE.txt).',
    `Its source code is at ${REPOSITORY}`,
    '',
    'Also shipped with Fixer:',
    '- Electron and Chromium: see LICENSE.electron.txt and LICENSES.chromium.html.',
    '- 7-Zip 25.01, Copyright (C) 1999-2025 Igor Pavlov: see resources\\7zip\\License.txt',
    '  (GNU LGPL, with BSD-licensed parts and the unRAR license restriction).',
    '  Its source code is at https://www.7-zip.org/',
    '',
    'Fixer includes the following open-source packages:',
    ''
  ]
  const sections = notices.map(
    (notice) =>
      `${'='.repeat(80)}\n${notice.name} ${notice.version} (${notice.license})\n\n${notice.text}\n`
  )
  return [...header, ...sections].join('\n')
}

export function thirdPartyNotices(): Plugin {
  return {
    name: 'third-party-notices',
    apply: 'build',
    generateBundle() {
      const dirs = new Map<string, string>()
      for (const id of this.getModuleIds()) {
        const match = PACKAGE_DIR.exec(id)
        if (match) {
          dirs.set(match[1].toLowerCase(), match[1])
        }
      }

      // Runtime dependencies aren't bundled, but they ship inside the app too.
      const dependencies = readJson(resolve('package.json')).dependencies ?? {}
      for (const name of Object.keys(dependencies)) {
        const dir = resolve('node_modules', name)
        dirs.set(dir.toLowerCase(), dir)
      }

      const notices = [...dirs.values()]
        .map(readNotice)
        .sort((a, b) => a.name.localeCompare(b.name))
      this.emitFile({ type: 'asset', fileName: FILE_NAME, source: render(notices) })
    }
  }
}
