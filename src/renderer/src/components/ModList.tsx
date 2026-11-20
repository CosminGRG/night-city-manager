import { useState, useEffect } from 'react'
import { TriangleAlert, PackageOpen, SearchX, Plus, FlaskConical } from 'lucide-react'
import type {
  DeployStatus,
  ModRecord,
  Result,
  BulkAction,
  BulkRequest,
  BulkResult,
  NexusRequirement,
  ModUpdate,
  VersionGroup,
  Settings
} from '@shared/types'
import type { Dependency } from '@shared/requirements'
import {
  requirementBadges,
  deployMessage,
  undeployWarning,
  dependentsOf,
  missingForBulkDeploy,
  type RequirementBadge,
  type RequirementContext
} from '@renderer/requirementsView'
import { RequirementBadges } from './RequirementBadges'
import { isCoreMod } from '@shared/mods'
import type { MessageKey } from '@shared/i18n/en'
import type { Translate } from '@shared/i18n/translate'
import { useI18n, useT } from '@renderer/i18n/context'
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from '@renderer/modLabels'
import { listRows, paginate, bulkCounts, bulkTargets } from '@renderer/modListView'
import {
  DEFAULT_LIST_OPTIONS,
  isInterrupted,
  modFacts,
  nextSort,
  type ListOptions,
  type ModFacts,
  type SortColumn
} from '@renderer/modFilters'
import { useFitRows } from '@renderer/useFitRows'
import { cleanedMessage, cleanedAnything } from '@renderer/leftoversView'
import { coreUpdates } from '@renderer/updatesView'
import { versionRows, type VersionRow, type LinkOption } from '@renderer/versionsView'
import { CoreModStatus } from './CoreModStatus'
import { Pagination } from './Pagination'
import { SearchBox } from './SearchBox'
import { VersionBadge } from './VersionBadge'
import { RemoveConfirmDialog } from './RemoveConfirmDialog'
import { type ModActions, ModControls } from './ModControls'
import { ActionsMenu } from './ActionsMenu'
import { BulkConfirmDialog } from './BulkConfirmDialog'
import { EmptyState } from './EmptyState'
import { VersionLinkDialog } from './VersionLinkDialog'
import { ModViewTabs } from './ModViewTabs'
import { TypeFilterMenu } from './TypeFilterMenu'
import { SortHeader } from './SortHeader'
import { RoundCheck } from './RoundCheck'
import { SelectionBar } from './SelectionBar'
import { SelectionRemoveDialog } from './SelectionRemoveDialog'
import { DependentsDialog } from './DependentsDialog'
import { checkState, selectedMods, selectionCounts, toggleAll } from '@renderer/selection'
import { toggleItems } from '@renderer/leftoversView'
import './ModList.css'

interface DeployState {
  deployments: Record<string, DeployStatus>
  installed: Dependency[]
  nexus: Record<number, NexusRequirement[]>
  updates: Record<string, ModUpdate>
  groups: VersionGroup[]
  bisecting: boolean
}

interface Busy {
  id: string
  label: string
}

interface ModListProps {
  importedCount: number
  newestFirst: boolean
  confirmDependents: boolean
  onSettingsChange: (settings: Settings) => void
  options: ListOptions
  onOptionsChange: (options: ListOptions) => void
  onImport: () => void
  onTroubleshoot: () => void
}

interface PendingOff {
  mods: ModRecord[]
  dependents: ModRecord[]
  fromSelection: boolean
}

interface BulkStep {
  action: BulkAction
  run: () => Promise<Result<BulkResult>>
}

interface Notice {
  text: string
  tone: 'info' | 'warning'
}

const BULK_BUSY: Record<BulkAction, MessageKey> = {
  deploy: 'mods.busy.deploying',
  purge: 'mods.busy.purging',
  remove: 'mods.busy.removing'
}

const BULK_DONE: Record<BulkAction, MessageKey> = {
  deploy: 'mods.bulk.deployed',
  purge: 'mods.bulk.purged',
  remove: 'mods.bulk.removed'
}

async function loadDeployState(): Promise<DeployState> {
  const [deployments, installed, nexus, updates, groups, bisect] = await Promise.all([
    window.api.listDeployments(),
    window.api.getInstalledDependencies(),
    window.api.getNexusRequirements(),
    window.api.getModUpdates(),
    window.api.getVersionGroups(),
    window.api.getBisect()
  ])
  return {
    deployments,
    installed,
    nexus,
    updates,
    groups,
    bisecting: bisect.ok && bisect.value !== null
  }
}

function noticeOf(warning: string | null, info: string[]): Notice | null {
  const parts = [warning, ...info].filter((part) => part !== null)
  if (parts.length === 0) return null
  return { text: parts.join(' '), tone: warning ? 'warning' : 'info' }
}

function keptMessage(mod: ModRecord, kept: string[], t: Translate): string {
  const values = { name: mod.name, files: kept.join(', ') }
  if (kept.length === mod.plan.files.length) {
    return t('mods.keptAll', values)
  }
  return t('mods.keptChanged', values)
}

function bulkMessage(
  action: BulkAction,
  { done, skipped, kept, cleaned }: BulkResult,
  t: Translate
): string {
  const parts = [t(BULK_DONE[action], { count: done })]

  if (skipped > 0) {
    parts.push(t('mods.bulk.skipped', { count: skipped }))
  }
  if (kept.length > 0) {
    const files = kept.map(({ name, files }) => `${name}: ${files.join(', ')}`).join(', ')
    parts.push(t('mods.bulk.kept', { files }))
  }

  if (cleaned && cleanedAnything(cleaned)) {
    parts.push(cleanedMessage(cleaned, t))
  }

  return parts.join(' ')
}

export function ModList({
  importedCount,
  newestFirst,
  confirmDependents,
  onSettingsChange,
  options,
  onOptionsChange,
  onImport,
  onTroubleshoot
}: ModListProps): React.JSX.Element {
  const [mods, setMods] = useState<ModRecord[] | null>(null)
  const [deployments, setDeployments] = useState<Record<string, DeployStatus>>({})
  const [installed, setInstalled] = useState<Dependency[]>([])
  const [nexus, setNexus] = useState<Record<number, NexusRequirement[]>>({})
  const [updates, setUpdates] = useState<Record<string, ModUpdate>>({})
  const [groups, setGroups] = useState<VersionGroup[]>([])
  const [picked, setPicked] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setListElement] = useFitRows()
  const [pendingRemoval, setPendingRemoval] = useState<ModRecord | null>(null)
  const [pendingLink, setPendingLink] = useState<ModRecord | null>(null)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [pendingBulk, setPendingBulk] = useState<BulkRequest | null>(null)
  const [bulkLabel, setBulkLabel] = useState<string | null>(null)
  const [bisecting, setBisecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [removingSelected, setRemovingSelected] = useState(false)
  const [pendingOff, setPendingOff] = useState<PendingOff | null>(null)

  const t = useT()

  function applyDeployState(state: DeployState): void {
    setDeployments(state.deployments)
    setInstalled(state.installed)
    setBisecting(state.bisecting)
    setNexus(state.nexus)
    setUpdates(state.updates)
    setGroups(state.groups)
  }

  async function refresh(): Promise<void> {
    applyDeployState(await loadDeployState())
  }

  function handleSearch(value: string): void {
    setQuery(value)
    setPage(1)
    setSelected(new Set())
  }

  function changeOptions(next: Partial<ListOptions>): void {
    onOptionsChange({ ...options, ...next })
    setPage(1)
    if (next.view !== undefined || next.types !== undefined) {
      setSelected(new Set())
    }
  }

  function handleSort(column: SortColumn): void {
    changeOptions({ sort: nextSort(options.sort, column) })
  }

  function clearFilters(): void {
    setQuery('')
    changeOptions({ view: DEFAULT_LIST_OPTIONS.view, types: DEFAULT_LIST_OPTIONS.types })
  }

  useEffect(() => {
    Promise.all([
      window.api.listMods(),
      window.api.getModUpdates(),
      window.api.getVersionGroups()
    ]).then(([library, modUpdates, versionGroups]) => {
      setMods(library)
      setUpdates(modUpdates)
      setGroups(versionGroups)
    })
  }, [importedCount])

  useEffect(() => {
    loadDeployState().then(applyDeployState)
  }, [])

  useEffect(() => {
    return window.api.onNexusUpdated(() => {
      window.api.getNexusRequirements().then(setNexus)
      window.api.getModUpdates().then(setUpdates)
      window.api.getVersionGroups().then(setGroups)
    })
  }, [])

  async function handleDeploy(mod: ModRecord, rowId = mod.id): Promise<void> {
    setBusy({
      id: rowId,
      label: rowId === mod.id ? t('mods.busy.deploying') : t('mods.busy.switching')
    })
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.deployMod(mod.id)
      const state = await loadDeployState()
      applyDeployState(state)

      if (!result.ok) {
        setError(result.error)
      } else {
        setNotice(deployMessage(mod, result.value, { ...state, library: mods ?? [], t }))
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleUndeploy(mod: ModRecord): Promise<void> {
    setBusy({ id: mod.id, label: t('mods.busy.undeploying') })
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.undeployMod(mod.id)
      const state = await loadDeployState()
      applyDeployState(state)

      if (!result.ok) {
        setError(result.error)
      } else {
        const { kept } = result.value
        const warning = undeployWarning(mod, { ...state, library: mods ?? [], t })
        setNotice(noticeOf(warning, kept.length > 0 ? [keptMessage(mod, kept, t)] : []))
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(
    mod: ModRecord,
    trashLeftover: boolean,
    allVersions: boolean,
    alsoOff: ModRecord[]
  ): Promise<void> {
    setBusy({ id: mod.id, label: t('mods.busy.removing') })
    setError(null)
    setNotice(null)
    const wasDeployed = deployments[mod.id] === 'deployed'
    const info: string[] = []
    try {
      // Switch off the mods that need it first, so nothing is left half-working.
      if (alsoOff.length > 0) {
        const ids = alsoOff.map((other) => other.id)
        const off = await window.api.runBulkSelected({ action: 'purge', ids })
        if (!off.ok) {
          setError(off.error)
          return
        }
        info.push(bulkMessage('purge', off.value, t))
      }
      const result = await window.api.removeMod(mod.id, trashLeftover, allVersions)
      const library = await window.api.listMods()
      setMods(library)
      const state = await loadDeployState()
      applyDeployState(state)

      if (!result.ok) {
        setError(result.error)
      } else {
        const { kept, cleaned, deployedInstead } = result.value

        if (deployedInstead) {
          info.push(t('mods.deployedInstead', { name: deployedInstead }))
        }
        if (kept.length > 0) {
          info.push(keptMessage(mod, kept, t))
        }
        if (cleaned && cleanedAnything(cleaned)) {
          info.push(cleanedMessage(cleaned, t))
        }

        const warning = wasDeployed ? undeployWarning(mod, { ...state, library, t }) : null
        setNotice(noticeOf(warning, info))
      }
    } finally {
      setBusy(null)
    }
  }

  //Shared by the Actions menu and the selection bar. Several steps run one after the
  //other (e.g. switch off what needs the selection, then remove it); one notice at the end.
  async function runBulkSteps(steps: BulkStep[]): Promise<void> {
    setError(null)
    setNotice(null)
    const messages: string[] = []
    const failed: BulkResult['failed'] = []

    try {
      for (const { action, run } of steps) {
        setBulkLabel(t(BULK_BUSY[action]))
        const result = await run()
        if (!result.ok) {
          setError(result.error)
          return
        }

        failed.push(...result.value.failed)
        messages.push(bulkMessage(action, result.value, t))
      }

      if (failed.length > 0) {
        const list = failed.map(({ name, error }) => `${name} (${error})`).join(', ')
        setError(t('mods.bulk.failed', { mods: list }))
      }
      setNotice({ text: messages.join(' '), tone: 'info' })
      setSelected(new Set())
    } finally {
      setMods(await window.api.listMods())
      await refresh()
      setBulkLabel(null)
    }
  }

  function runBulkAction(action: BulkAction, run: BulkStep['run']): Promise<void> {
    return runBulkSteps([{ action, run }])
  }

  function removeSelected(trashLeftovers: boolean, alsoOff: ModRecord[]): Promise<void> {
    const ids = selection.map((mod) => mod.id)
    const offIds = alsoOff.map((mod) => mod.id)
    const off: BulkStep[] =
      offIds.length > 0
        ? [
            {
              action: 'purge',
              run: () => window.api.runBulkSelected({ action: 'purge', ids: offIds })
            }
          ]
        : []

    return runBulkSteps([
      ...off,
      {
        action: 'remove',
        run: () => window.api.runBulkSelected({ action: 'remove', ids, trashLeftovers })
      }
    ])
  }

  //Removing the deployed version puts the newest other version in its place so nothing breaks unless every version goes or there is no other to deploy.
  function removalDependents(
    mod: ModRecord,
    others: ModRecord[],
    allVersions: boolean
  ): ModRecord[] {
    if (deployments[mod.id] !== 'deployed') return []
    if (!allVersions && others.some((other) => other.plan.files.length > 0)) return []

    const ids = [mod, ...(allVersions ? others : [])].map((version) => version.id)
    return dependentsOf(ids, requirementContext)
  }

  function handleBulk(request: BulkRequest): Promise<void> {
    return runBulkAction(request.action, () => window.api.runBulk(request))
  }

  function handleSelected(action: BulkAction, trashLeftovers = false): Promise<void> {
    const ids = selection.map((mod) => mod.id)
    return runBulkAction(action, () => window.api.runBulkSelected({ action, ids, trashLeftovers }))
  }

  function switchOff(mods: ModRecord[], fromSelection: boolean): void {
    if (fromSelection) {
      handleSelected('purge')
    } else {
      handleUndeploy(mods[0])
    }
  }

  function requestOff(mods: ModRecord[], fromSelection: boolean): void {
    const ids = mods.map((mod) => mod.id)
    const dependents = confirmDependents ? dependentsOf(ids, requirementContext) : []

    if (dependents.length === 0) {
      switchOff(mods, fromSelection)
    } else {
      setPendingOff({ mods, dependents, fromSelection })
    }
  }

  async function stopAskingAboutDependents(): Promise<void> {
    const result = await window.api.setConfirmDependents(false)
    if (result.ok) {
      onSettingsChange(result.value)
    }
  }

  function confirmOff(off: PendingOff, alsoDependents: boolean, stopAsking: boolean): void {
    if (stopAsking) {
      stopAskingAboutDependents()
    }
    if (!alsoDependents) {
      switchOff(off.mods, off.fromSelection)
      return
    }

    const ids = [...off.mods, ...off.dependents].map((mod) => mod.id)
    runBulkAction('purge', () => window.api.runBulkSelected({ action: 'purge', ids }))
  }

  function handlePickVersion(row: VersionRow, version: ModRecord): void {
    if (deployments[row.mod.id] !== undefined) {
      handleDeploy(version, row.mod.id)
    } else {
      setPicked((current) => ({ ...current, [row.key]: version.id }))
    }
  }

  async function handleLink(mod: ModRecord, target: LinkOption | null): Promise<void> {
    setError(null)
    setNotice(null)
    const result = await window.api.setVersionOf(mod.id, target?.id ?? null)
    setMods(await window.api.listMods())
    applyDeployState(await loadDeployState())

    if (!result.ok) {
      setError(result.error)
    } else {
      const text = target
        ? t('mods.linked', { name: mod.name, target: target.name })
        : t('mods.unlinked', { name: mod.name })

      setNotice({ text, tone: 'info' })
    }
  }

  async function showFailure(action: Promise<Result<null>>): Promise<void> {
    const result = await action
    if (!result.ok) setError(result.error)
  }

  const actions: ModActions = {
    deploy: handleDeploy,
    undeploy: (mod) => requestOff([mod], false),
    remove: setPendingRemoval,
    reveal: (mod) => showFailure(window.api.revealMod(mod.id)),
    openNexus: (mod) => showFailure(window.api.openNexusPage(mod.id)),
    openNexusFiles: (mod) => showFailure(window.api.openNexusFiles(mod.id)),
    linkVersion: setPendingLink
  }

  const requirementContext: RequirementContext = {
    library: mods ?? [],
    installed,
    deployments,
    nexus,
    t
  }

  const { rows, skip } = versionRows(mods ?? [], groups, deployments, picked)
  const rowOf = new Map(rows.map((row) => [row.mod.id, row]))
  const badgesOf = new Map(
    rows.map((row) => [row.mod.id, requirementBadges(row.mod, requirementContext)])
  )
  const facts = new Map<string, ModFacts>(
    rows.map(({ mod }) => [
      mod.id,
      modFacts(mod, deployments[mod.id], badgesOf.get(mod.id) ?? [], mod.id in updates)
    ])
  )
  const listed = listRows(rows, options, query, { newestFirst, sort: options.sort, facts })
  const listedMods = listed.rows.map((row) => row.mod)
  const visible = mods && paginate(listedMods, page, pageSize)
  const otherVersionsOf = (mod: ModRecord): ModRecord[] =>
    (rowOf.get(mod.id)?.versions ?? []).filter((version) => version.id !== mod.id)
  const filtered = query !== '' || options.view !== 'all' || options.types.length > 0
  const listedIds = listedMods.map((mod) => mod.id)
  const selection = selectedMods(listedMods, selected)
  const selectionState = checkState(selected, listedIds)
  const locked = busy !== null || bulkLabel !== null
  const changesLocked = locked || bisecting
  const counts = bulkCounts(mods ?? [], deployments, skip)

  return (
    <section className="mods">
      <CoreModStatus
        installed={installed}
        updates={coreUpdates(mods ?? [], deployments, updates)}
        onOpenFiles={actions.openNexusFiles}
      />
      <header className="mods-header">
        <div className="mods-title">
          <div className="mods-heading">
            <h2>
              {t('mods.title')} <span className="mods-count">{rows.length}</span>
            </h2>
          </div>
          <button className="with-icon" onClick={onImport} disabled={locked}>
            <Plus size={16} aria-hidden="true" />
            {t('mods.import')}
          </button>
          <ActionsMenu
            counts={counts}
            busyLabel={bulkLabel}
            locked={changesLocked}
            onSelect={setPendingBulk}
          />
        </div>
        <SearchBox value={query} onChange={handleSearch} />
      </header>

      {mods && mods.length > 0 && selection.length > 0 && (
        <SelectionBar
          selected={selection.length}
          state={selectionState}
          counts={selectionCounts(selection, deployments)}
          locked={changesLocked}
          onToggleAll={() => setSelected(toggleAll(selected, listedIds))}
          onAction={(action) => {
            if (action === 'remove') {
              setRemovingSelected(true)
            } else if (action === 'purge') {
              requestOff(selection, true)
            } else {
              handleSelected(action)
            }
          }}

          onClear={() => setSelected(new Set())}
        />
      )}

      {mods && mods.length > 0 && selection.length === 0 && (
        <div className="mods-views">
          <ModViewTabs
            view={options.view}
            counts={listed.counts}
            onChange={(view) => changeOptions({ view })}
          />
          <TypeFilterMenu types={options.types} onChange={(types) => changeOptions({ types })} />
        </div>
      )}

      {bisecting && (
        <div className="bisect-banner mods-message" role="status">
          <FlaskConical size={16} aria-hidden="true" />
          <span>{t('mods.bisecting')}</span>
          <button className="small" onClick={onTroubleshoot}>
            {t('mods.openTroubleshoot')}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="error mods-message">
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className={
            notice.tone === 'warning' ? 'notice notice-warning mods-message' : 'notice mods-message'
          }
        >
          {notice.tone === 'warning' && <TriangleAlert size={16} aria-hidden="true" />}
          {notice.text}
        </p>
      )}
      {mods === null && <p className="muted">{t('app.loading')}</p>}
      {mods?.length === 0 && (
        <EmptyState icon={PackageOpen} title={t('mods.empty')}>
          <p>{t('mods.emptyHint')}</p>
          <button className="primary" onClick={onImport}>
            {t('mods.import')}
          </button>
        </EmptyState>
      )}
      {visible && mods && mods.length > 0 && visible.total === 0 && (
        <EmptyState
          icon={SearchX}
          title={query === '' ? t('mods.emptyView') : t('mods.noMatch', { query })}
        >
          {filtered && <button onClick={clearFilters}>{t('mods.clearFilters')}</button>}
        </EmptyState>
      )}

      {visible && visible.total > 0 && (
        <>
          <div className="mod-table">
            <div className="mod-row mod-head">
              <span className="mod-cell mod-status">
                <RoundCheck
                  state={selectionState}
                  label={t('mods.selectAll')}
                  onToggle={() => setSelected(toggleAll(selected, listedIds))}
                />
              </span>

              <span>
                <SortHeader
                  column="name"
                  label={t('mods.column.name')}
                  sort={options.sort}
                  onSort={handleSort}
                />
              </span>
              <span>{t('mods.column.version')}</span>
              <span>
                <SortHeader
                  column="type"
                  label={t('mods.column.type')}
                  sort={options.sort}
                  onSort={handleSort}
                />
              </span>
              <span>{t('mods.column.requires')}</span>
              <span>
                <SortHeader
                  column="imported"
                  label={t('mods.column.imported')}
                  sort={options.sort}
                  onSort={handleSort}
                />
              </span>
              <span />
            </div>

            <ul className="mod-list" ref={setListElement}>
              {visible.items.map((mod) => (
                <ModRow
                  key={mod.id}
                  mod={mod}
                  status={deployments[mod.id]}
                  selected={selected.has(mod.id)}
                  onSelect={(on) => setSelected((current) => toggleItems(current, [mod.id], on))}
                  requirements={badgesOf.get(mod.id) ?? []}
                  update={updates[mod.id]}
                  versions={rowOf.get(mod.id)?.versions ?? [mod]}
                  onPickVersion={(version) => {
                    const row = rowOf.get(mod.id)
                    if (row) {
                      handlePickVersion(row, version)
                    }
                  }}
                  busyLabel={busy?.id === mod.id ? busy.label : null}
                  locked={changesLocked}
                  actions={actions}
                />
              ))}
            </ul>
          </div>
          <footer className="mods-footer">
            <span className="muted">
              {t('mods.range', { first: visible.first, last: visible.last, total: visible.total })}
            </span>
            {visible.pageCount > 1 && (
              <Pagination page={visible.page} pageCount={visible.pageCount} onChange={setPage} />
            )}
          </footer>
        </>
      )}

      {pendingRemoval && (
        <RemoveConfirmDialog
          mod={pendingRemoval}
          otherVersions={otherVersionsOf(pendingRemoval)}
          deployed={deployments[pendingRemoval.id] !== undefined}
          dependentsFor={(allVersions) =>
            removalDependents(pendingRemoval, otherVersionsOf(pendingRemoval), allVersions)
          }
          onConfirm={(trashLeftovers, allVersions, alsoOff) =>
            handleRemove(pendingRemoval, trashLeftovers, allVersions, alsoOff)
          }
          onClose={() => setPendingRemoval(null)}
        />
      )}

      {pendingLink && (
        <VersionLinkDialog
          mod={pendingLink}
          onSave={(target) => handleLink(pendingLink, target)}
          onClose={() => setPendingLink(null)}
        />
      )}

      {pendingOff && (
        <DependentsDialog
          mods={pendingOff.mods}
          dependents={pendingOff.dependents}
          onAnyway={(stopAsking) => confirmOff(pendingOff, false, stopAsking)}
          onAlso={(stopAsking) => confirmOff(pendingOff, true, stopAsking)}
          onClose={() => setPendingOff(null)}
        />
      )}

      {removingSelected && (
        <SelectionRemoveDialog
          count={selection.length}
          anyDeployed={selection.some((mod) => deployments[mod.id] !== undefined)}
          dependents={dependentsOf(
            selection.map((mod) => mod.id),
            requirementContext
          )}
          onConfirm={removeSelected}
          onClose={() => setRemovingSelected(false)}
        />
      )}

      {pendingBulk && (
        <BulkConfirmDialog
          request={pendingBulk}
          count={counts[pendingBulk.action][pendingBulk.scope]}
          missing={
            pendingBulk.action === 'deploy'
              ? missingForBulkDeploy(
                  bulkTargets(mods ?? [], deployments, 'deploy', pendingBulk.scope, skip),
                  requirementContext
                )
              : []
          }
          onConfirm={(trashLeftovers) => handleBulk({ ...pendingBulk, trashLeftovers })}
          onClose={() => setPendingBulk(null)}
        />
      )}
    </section>
  )
}

function rowClass(core: boolean, selected: boolean): string {
  return ['mod-row', core && 'core', selected && 'selected'].filter(Boolean).join(' ')
}

interface ModRowProps {
  mod: ModRecord
  status: DeployStatus | undefined
  selected: boolean
  onSelect: (on: boolean) => void
  requirements: RequirementBadge[]
  update: ModUpdate | undefined
  versions: ModRecord[]
  onPickVersion: (version: ModRecord) => void
  busyLabel: string | null
  locked: boolean
  actions: ModActions
}

function ModRow({
  mod,
  status,
  selected,
  onSelect,
  requirements,
  update,
  versions,
  onPickVersion,
  busyLabel,
  locked,
  actions
}: ModRowProps): React.JSX.Element {
  const { t, language } = useI18n()
  const warnings = isInterrupted(status)
    ? [t('mods.interruptedWarning'), ...mod.plan.warnings]
    : mod.plan.warnings
  const frameworks = mod.plan.providers.map((framework) => FRAMEWORK_LABELS[framework])

  return (
    <li className={rowClass(isCoreMod(mod), selected)}>
      <span className="mod-cell mod-status">
        <RoundCheck
          state={selected ? 'all' : 'none'}
          label={t('mods.select', { name: mod.name })}
          onToggle={() => onSelect(!selected)}
        />
      </span>

      <span className="mod-cell">
        {warnings.length > 0 && (
          <span
            className="mod-warning"
            role="img"
            aria-label={warnings.join(' ')}
            title={warnings.join('\n')}
          >
            <TriangleAlert size={14} aria-hidden="true" />
          </span>
        )}
        <span className="mod-name" title={mod.name}>
          {mod.name}
        </span>
      </span>

      <span className="mod-cell">
        <VersionBadge
          mod={mod}
          versions={versions}
          update={update}
          deployed={status !== undefined}
          locked={locked}
          onPick={onPickVersion}
          onOpenFiles={() => actions.openNexusFiles(mod)}
        />
      </span>

      <span className="mod-cell mod-badges">
        {isCoreMod(mod) && (
          <span
            className="badge badge-core"
            title={t('mods.coreTitle', { frameworks: frameworks.join(', ') })}
          >
            {t('mods.core')}
          </span>
        )}
        {mod.plan.types.map((type) => (
          <span key={type} className={`badge badge-${type}`}>
            {MOD_TYPE_LABELS[type]}
          </span>
        ))}
      </span>

      <span className="mod-cell mod-badges">
        <RequirementBadges badges={requirements} />
      </span>

      <span className="mod-cell mod-date">
        {new Date(mod.importedAt).toLocaleDateString(language, { dateStyle: 'medium' })}
      </span>

      <span className="mod-cell mod-actions">
        <ModControls
          mod={mod}
          status={status}
          busyLabel={busyLabel}
          locked={locked}
          actions={actions}
        />
      </span>
    </li>
  )
}
