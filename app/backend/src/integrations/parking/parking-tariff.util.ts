import type { ParkingDay, ParkingTariffRule } from './parking.types'

export interface ParkingTariffResult {
  cost: number | null
  status: 'calculated' | 'rate_only'
  reason?: string
}

export interface TariffCalculationOptions {
  publicHolidayDates?: Iterable<string>
  isPublicHoliday?: boolean
}

/**
 * Evaluates a parking tariff in Singapore local time. Each billable unit is
 * anchored at its actual start time, making time-band and midnight boundaries
 * deterministic without relying on the host machine timezone.
 */
export function calculateParkingCost(
  rules: ParkingTariffRule[],
  startTime: Date | string,
  durationMinutes: number,
  options: TariffCalculationOptions = {},
): ParkingTariffResult {
  const start = startTime instanceof Date ? new Date(startTime) : new Date(startTime)
  if (
    Number.isNaN(start.getTime()) ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0 ||
    !rules.length
  ) {
    return { cost: null, status: 'rate_only', reason: 'Parking tariff or duration is unavailable.' }
  }

  const holidayDates = new Set(options.publicHolidayDates ?? [])
  let remaining = durationMinutes
  let cursor = start
  let total = 0
  let appliedCap: number | undefined
  let guard = 0

  while (remaining > 0.0001 && guard++ < 1000) {
    const local = singaporeParts(cursor)
    const day = dayFor(local, options.isPublicHoliday || holidayDates.has(local.date))
    const active = rules.filter((rule) => matchesDay(rule.days, day) && activeAt(rule, local.minuteOfDay))
    if (!active.length)
      return { cost: null, status: 'rate_only', reason: 'Published tariff has an uncovered time band.' }
    if (active.length > 1) {
      const distinct = new Set(
        active.map((rule) => `${rule.rate}:${rule.billing}:${rule.billingUnitMinutes}:${rule.cap ?? ''}`),
      )
      if (distinct.size > 1)
        return { cost: null, status: 'rate_only', reason: 'Published tariff is ambiguous.' }
    }
    const rule = active[0]
    if (rule.billing === 'per_entry') {
      total += rule.rate
      appliedCap = minCap(appliedCap, rule.cap)
      remaining = 0
      break
    }
    const billingUnitMinutes = Math.max(1, rule.billingUnitMinutes)
    total += rule.rate
    appliedCap = minCap(appliedCap, rule.cap)
    const billedMinutes = Math.min(remaining, billingUnitMinutes)
    remaining -= billedMinutes
    cursor = new Date(cursor.getTime() + billingUnitMinutes * 60_000)
  }

  if (remaining > 0.0001 || guard >= 1000)
    return { cost: null, status: 'rate_only', reason: 'Tariff duration could not be evaluated.' }
  const cost = Math.max(0, appliedCap === undefined ? total : Math.min(total, appliedCap))
  return { cost: Number(cost.toFixed(2)), status: 'calculated' }
}

export function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const text = String(value).trim().toUpperCase().replace(/\s+/g, ' ')
  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [hour, minute] = text.split(':').map(Number)
    return hour <= 23 && minute <= 59 ? hour * 60 + minute : null
  }
  const match = text.match(/^(\d{1,2})(?:\.(\d{2}))?\s*(AM|PM)$/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] ?? 0)
  if (hour < 1 || hour > 12 || minute > 59) return null
  if (match[3] === 'AM' && hour === 12) hour = 0
  if (match[3] === 'PM' && hour !== 12) hour += 12
  return hour * 60 + minute
}

export function parseRate(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const match = String(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const rate = Number(match[0])
  return Number.isFinite(rate) && rate >= 0 ? rate : null
}

export function parseBillingMinutes(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 ? value : null
  if (typeof value !== 'string') return null
  const match = value.match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const minutes = Number(match[0])
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null
}

function matchesDay(days: ParkingDay[], day: ParkingDay) {
  return days.includes(day)
}

function activeAt(rule: ParkingTariffRule, minute: number) {
  if (rule.startMinute === rule.endMinute) return true
  if (rule.endMinute > rule.startMinute) return minute >= rule.startMinute && minute < rule.endMinute
  return minute >= rule.startMinute || minute < rule.endMinute
}

function dayFor(local: SingaporeParts, publicHoliday: boolean): ParkingDay {
  if (publicHoliday) return 'public_holiday'
  if (local.weekday === 0) return 'sunday'
  if (local.weekday === 6) return 'saturday'
  return 'weekday'
}

interface SingaporeParts {
  date: string
  weekday: number
  minuteOfDay: number
}

function singaporeParts(value: Date): SingaporeParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(formatter.formatToParts(value).map((part) => [part.type, part.value]))
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

function minCap(current: number | undefined, next: number | undefined) {
  if (next === undefined) return current
  return current === undefined ? next : Math.min(current, next)
}
