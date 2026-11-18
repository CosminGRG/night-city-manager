import type { LogFile, LogSource } from '@shared/types'
import type { Translate } from '@shared/i18n/translate'

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

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function formatWhen(iso: string, now: Date, t: Translate, language: string): string {
  const date = new Date(iso)
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000)

  if (minutes < 1) {
    return t('time.justNow')
  }
  if (minutes < 60) {
    const relative = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: 'short' })
    return relative.format(-minutes, 'minute')
  }

  const time = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(
    date
  )
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)

  if (days <= 1) {
    // "today" / "yesterday" in the chosen language
    const day = new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(-days, 'day')
    return t('time.dayAt', { day, time })
  }

  const sameYear = date.getFullYear() === now.getFullYear()
  const day = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric'
  }).format(date)
  return t('time.dateAt', { date: day, time })
}
