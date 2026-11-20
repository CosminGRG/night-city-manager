import { useEffect, useState } from 'react'
import {
  Circle,
  CircleCheck,
  TriangleAlert,
  PackageOpen,
  SearchX,
  Plus,
  FlaskConical
} from 'lucide-react'
import type {
  DeployStatus,
  ModRecord,
  Result,
  BulkAction,
  BulkRequest,
  BulkResult,
  NexusRequirement,
  ModUpdate,
  VersionGroup
} from '@shared/types'
import type { Dependency } from '@shared/requirements'
import {
  requirementBadges,
  deployMessage,
  undeployWarning,
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
import { filterMods, paginate, sortRows, bulkCounts, bulkTargets } from '@renderer/modListView'
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
  onImport: () => void
  onTroubleshoot: () => void
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
    allVersions: boolean
  ): Promise<void> {
    setBusy({ id: mod.id, label: t('mods.busy.removing') })
    setError(null)
    setNotice(null)
    const wasDeployed = deployments[mod.id] === 'deployed'
    try {
      const result = await window.api.removeMod(mod.id, trashLeftover, allVersions)
      const library = await window.api.listMods()
      setMods(library)
      const state = await loadDeployState()
      applyDeployState(state)

      if (!result.ok) {
        setError(result.error)
      } else {
        const { kept, cleaned, deployedInstead } = result.value
        const info: string[] = []

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

  async function handleBulk(request: BulkRequest): Promise<void> {
    setBulkLabel(t(BULK_BUSY[request.action]))
    setError(null)
    setNotice(null)

    try {
      const result = await window.api.runBulk(request)
      if (!result.ok) {
        setError(result.error)
        return
      }

      const { failed } = result.value
      if (failed.length > 0) {
        const list = failed.map(({ name, error }) => `${name} (${error})`).join(', ')
        setError(t('mods.bulk.failed', { mods: list }))
      }
      setNotice({ text: bulkMessage(request.action, result.value, t), tone: 'info' })
    } finally {
      setMods(await window.api.listMods())
      await refresh()
      setBulkLabel(null)
    }
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
    undeploy: handleUndeploy,
    remove: setPendingRemoval,
    reveal: (mod) => showFailure(window.api.revealMod(mod.id)),
    openNexus: (mod) => showFailure(window.api.openNexusPage(mod.id)),
    openNexusFiles: (mod) => showFailure(window.api.openNexusFiles(mod.id)),
    linkVersion: setPendingLink
  }

  const { rows, skip } = versionRows(mods ?? [], groups, deployments, picked)
  const rowOf = new Map(rows.map((row) => [row.mod.id, row]))
  const sorted = sortRows(rows, newestFirst).map((row) => row.mod)
  const visible = mods && paginate(filterMods(sorted, query), page, pageSize)
  const locked = busy !== null || bulkLabel !== null
  const changesLocked = locked || bisecting
  const counts = bulkCounts(mods ?? [], deployments, skip)
  const statuses = (mods ?? []).map((mod) => deployments[mod.id])
  const activeCount = statuses.filter((status) => status === 'deployed').length
  const interrupedCount = statuses.filter(
    (status) => status === 'deploying' || status === 'undeploying'
  ).length
  const requirementContext: RequirementContext = {
    library: mods ?? [],
    installed,
    deployments,
    nexus,
    t
  }

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
            <span
              className={activeCount > 0 ? 'stat-chip' : 'stat-chip idle'}
              title={t('mods.activeTitle')}
            >
              <span className="stat-dot" aria-hidden="true" />
              {t('mods.active', { count: activeCount })}
            </span>
            {interrupedCount > 0 && (
              <span className="stat-chip interrupted" title={t('mods.interruptedTitle')}>
                <TriangleAlert size={12} aria-hidden="true" />
                {t('mods.interrupted', { count: interrupedCount })}
              </span>
            )}
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
        <EmptyState icon={SearchX} title={t('mods.noMatch', { query })}>
          <button onClick={() => handleSearch('')}>{t('mods.clearSearch')}</button>
        </EmptyState>
      )}

      {visible && visible.total > 0 && (
        <>
          <div className="mod-table">
            <div className="mod-row mod-head" aria-hidden="true">
              <span />
              <span>{t('mods.column.name')}</span>
              <span>{t('mods.column.version')}</span>
              <span>{t('mods.column.type')}</span>
              <span>{t('mods.column.requires')}</span>
              <span>{t('mods.column.imported')}</span>
              <span />
            </div>
            <ul className="mod-list" ref={setListElement}>
              {visible.items.map((mod) => (
                <ModRow
                  key={mod.id}
                  mod={mod}
                  status={deployments[mod.id]}
                  requirements={requirementBadges(mod, requirementContext)}
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
          otherVersions={(rowOf.get(pendingRemoval.id)?.versions ?? []).filter(
            (version) => version.id !== pendingRemoval.id
          )}
          deployed={deployments[pendingRemoval.id] !== undefined}
          onConfirm={(trashLeftovers, allVersions) =>
            handleRemove(pendingRemoval, trashLeftovers, allVersions)
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

function StatusIcon({ status }: { status: DeployStatus | undefined }): React.JSX.Element {
  const t = useT()

  if (status === 'deployed') {
    const label = t('mods.status.deployed')
    return (
      <span className="status status-deployed" role="img" aria-label={label} title={label}>
        <CircleCheck size={16} aria-hidden="true" />
      </span>
    )
  }
  if (status) {
    const label = t('mods.status.interrupted')
    return (
      <span className="status status-interrupted" role="img" aria-label={label} title={label}>
        <TriangleAlert size={16} aria-hidden="true" />
      </span>
    )
  }
  const label = t('mods.status.idle')
  return (
    <span className="status status-idle" role="img" aria-label={label} title={label}>
      <Circle size={16} aria-hidden="true" />
    </span>
  )
}

interface ModRowProps {
  mod: ModRecord
  status: DeployStatus | undefined
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
  requirements,
  update,
  versions,
  onPickVersion,
  busyLabel,
  locked,
  actions
}: ModRowProps): React.JSX.Element {
  const { t, language } = useI18n()
  const interrupted = status === 'deploying' || status === 'undeploying'
  const warnings = interrupted
    ? [t('mods.interruptedWarning'), ...mod.plan.warnings]
    : mod.plan.warnings
  const frameworks = mod.plan.providers.map((framework) => FRAMEWORK_LABELS[framework])

  return (
    <li className={isCoreMod(mod) ? 'mod-row core' : 'mod-row'}>
      <span className="mod-cell mod-status">
        <StatusIcon status={status} />
      </span>

      <span className="mod-cell">
        <span className="mod-name" title={mod.name}>
          {mod.name}
        </span>

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
