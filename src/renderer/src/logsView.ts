import type { LogFile, LogSource } from '@shared/types'

export const SOURCE_LABELS: Record<LogSource, string> = {
  cet: 'Cyber Engine Tweaks',
  redscript: 'redscript',
  red4ext: 'RED4ext'
}

export interface LogGroup {
  source: LogSource
  label: string
  logs: LogFile[]
}

export function groupLogs(logs: LogFile[]): LogGroup[] {
  const groups = new Map<LogSource, LogFile[]>()
  for (const log of logs) {
    groups.set(log.source, [...(groups.get(log.source) ?? []), log])
  }

  return [...groups].map(([source, logs]) => ({ source, label: SOURCE_LABELS[source], logs }))
}

const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const DAY_YEAR = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
})

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function formatWhen(iso: string, now: Date): string {
  const date = new Date(iso)
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)

  if (minutes < 1) {
    return 'just now'
  }
  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const time = TIME.format(date)
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)

  if (days === 0) {
    return `today ${time}`
  }
  if (days === 1) {
    return `yesterday ${time}`
  }

  const day = date.getFullYear() === now.getFullYear() ? DAY.format(date) : DAY_YEAR.format(date)
  return `${day}, ${time}`
}
