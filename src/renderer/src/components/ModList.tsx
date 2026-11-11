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
import { FRAMEWORK_LABELS, MOD_TYPE_LABELS } from '@renderer/modLabels'
import { filterMods, paginate, sortMods, bulkCounts, bulkTargets } from '@renderer/modListView'
import { cleanedMessage } from '@renderer/leftoversView'
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

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const INTERRUPTED = 'The last deploy or undeploy was interrupted. Undeploy to clean up.'

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
  onImport: () => void
  onTroubleshoot: () => void
}

interface Notice {
  text: string
  tone: 'info' | 'warning'
}

const BULK_BUSY: Record<BulkAction, string> = {
  deploy: 'Deploying...',
  purge: 'Purging...',
  remove: 'Removing...'
}

const BULK_DONE: Record<BulkAction, string> = {
  deploy: 'Deployed',
  purge: 'Purged',
  remove: 'Removed'
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

function keptMessage(mod: ModRecord, kept: string[]): string {
  const files = kept.join(', ')
  if (kept.length === mod.plan.files.length) {
    return `${mod.name}: none of its files could be verified, so all were left in place (was its folder in "mods" deleted?): ${files}`
  }
  return `${mod.name}: left in place because they changed after deploy: ${files}`
}

function bulkMessage(action: BulkAction, { done, skipped, kept, cleaned }: BulkResult): string {
  const parts = [`${BULK_DONE[action]} ${done} ${done === 1 ? 'mod' : 'mods'}.`]

  if (skipped > 0) {
    parts.push(
      `Skipped ${skipped} that can't be deployed automatically (nothing to place or and interrupted deploy, needs undeploy first).`
    )
  }
  if (kept.length > 0) {
    const files = kept.map(({ name, files }) => `${name}: ${files.join(', ')}`).join(', ')
    parts.push(`Left in place because they changed after deploy: ${files}`)
  }

  if (cleaned) {
    parts.push(cleanedMessage(cleaned))
  }

  return parts.join(' ')
}

export function ModList({
  importedCount,
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
  const [pendingRemoval, setPendingRemoval] = useState<ModRecord | null>(null)
  const [pendingLink, setPendingLink] = useState<ModRecord | null>(null)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [pendingBulk, setPendingBulk] = useState<BulkRequest | null>(null)
  const [bulkLabel, setBulkLabel] = useState<string | null>(null)
  const [bisecting, setBisecting] = useState(false)

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
    setBusy({ id: rowId, label: rowId === mod.id ? 'Deploying...' : 'Switching...' })
    setError(null)
    setNotice(null)
    try {
      const result = await window.api.deployMod(mod.id)
      const state = await loadDeployState()
      applyDeployState(state)

      if (!result.ok) {
        setError(result.error)
      } else {
        setNotice(deployMessage(mod, result.value, { ...state, library: mods ?? [] }))
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleUndeploy(mod: ModRecord): Promise<void> {
    setBusy({ id: mod.id, label: 'Undeploying...' })
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
        const warning = undeployWarning(mod, { ...state, library: mods ?? [] })
        setNotice(noticeOf(warning, kept.length > 0 ? [keptMessage(mod, kept)] : []))
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
    setBusy({ id: mod.id, label: 'Removing...' })
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
        const { kept, cleaned } = result.value
        const info: string[] = []
        if (kept.length > 0) info.push(keptMessage(mod, kept))
        if (cleaned) info.push(cleanedMessage(cleaned))
        const warning = wasDeployed ? undeployWarning(mod, { ...state, library }) : null
        setNotice(noticeOf(warning, info))
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleBulk(request: BulkRequest): Promise<void> {
    setBulkLabel(BULK_BUSY[request.action])
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
        setError(`Failed ${failed.map(({ name, error }) => `${name} (${error})`).join(', ')}`)
      }
      setNotice({ text: bulkMessage(request.action, result.value), tone: 'info' })
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
        ? `${mod.name} is now a version of ${target.name}`
        : `${mod.name} is a separate mod.`

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
  const visible = mods && paginate(filterMods(sortMods(rows.map((row) => row.mod)), query), page)
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
    nexus
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
              Mods <span className="mods-count">{rows.length}</span>
            </h2>
            <span
              className={activeCount > 0 ? 'stat-chip' : 'stat-chip idle'}
              title="Deployed to your game folder"
            >
              <span className="stat-dot" aria-hidden="true" />
              {activeCount} active
            </span>
            {interrupedCount > 0 && (
              <span
                className="stat-chip interrupted"
                title="A deploy or undeploy was interrupted. Undeploy these mods to clean up."
              >
                <TriangleAlert size={12} aria-hidden="true" />
                {interrupedCount} interrupted
              </span>
            )}
          </div>
          <button className="with-icon" onClick={onImport} disabled={locked}>
            <Plus size={16} aria-hidden="true" />
            Import archives
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
          <span>
            A bisect is running, so mods can&apos;t be changed until you finish or stop it.
          </span>
          <button className="small" onClick={onTroubleshoot}>
            Open Troubleshoot
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
      {mods === null && <p className="muted">Loading...</p>}
      {mods?.length === 0 && (
        <EmptyState icon={PackageOpen} title="No mods yet">
          <p>Drag mod archives anywhere into the window, or pick them from your disk.</p>
          <button className="primary" onClick={onImport}>
            Import archives
          </button>
        </EmptyState>
      )}
      {visible && mods && mods.length > 0 && visible.total === 0 && (
        <EmptyState icon={SearchX} title={`No mods match "${query}"`}>
          <button onClick={() => handleSearch('')}>Clear search</button>
        </EmptyState>
      )}

      {visible && visible.total > 0 && (
        <>
          <div className="mod-table">
            <div className="mod-row mod-head" aria-hidden="true">
              <span />
              <span>Name</span>
              <span>Ver.</span>
              <span>Type</span>
              <span>Requires</span>
              <span>Imported</span>
              <span />
            </div>
            <ul className="mod-list">
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
              {visible.first}–{visible.last} of {visible.total}
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
  if (status === 'deployed') {
    return (
      <span className="status status-deployed" role="img" aria-label="Deployed" title="Deployed">
        <CircleCheck size={16} aria-hidden="true" />
      </span>
    )
  }
  if (status) {
    return (
      <span
        className="status status-interrupted"
        role="img"
        aria-label="Interrupted"
        title="Interrupted"
      >
        <TriangleAlert size={16} aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className="status status-idle" role="img" aria-label="Not deployed" title="Not deployed">
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
  const interrupted = status === 'deploying' || status === 'undeploying'
  const warnings = interrupted ? [INTERRUPTED, ...mod.plan.warnings] : mod.plan.warnings

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
            title={`Core mod: ${mod.plan.providers.map((framework) => FRAMEWORK_LABELS[framework]).join(', ')}`}
          >
            Core
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

      <span className="mod-cell mod-date">{dateFormat.format(new Date(mod.importedAt))}</span>

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
