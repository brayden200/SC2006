import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { ConnectorType } from '../common/types'

export interface StoredMonitorEvent {
  id: string
  type: 'started' | 'availability_changed' | 'alternative_accepted' | 'stale_warning'
  message: string
  timestamp: string
}

export interface StoredMonitor {
  id: string
  stationId: string
  connector: ConnectorType
  createdAt: string
  expiresAt: string
  lastCheckedAt: string
  lastKnownAvailability: number | null
  status: 'active' | 'expired' | 'stopped'
  events: StoredMonitorEvent[]
}

interface StorageFile {
  version: 1
  monitors: unknown
}

@Injectable()
export class MonitorRepository {
  readonly filePath: string
  private loaded = false
  private monitors: StoredMonitor[] = []

  constructor(config: ConfigService) {
    const configuredDirectory = config.get<string>('CHARGEWISE_DATA_DIR')
    const dataDirectory = resolve(configuredDirectory ?? join(process.cwd(), 'runtime-data'))
    this.filePath = join(dataDirectory, 'monitors.json')
  }

  getAll() {
    this.ensureLoaded()
    return structuredClone(this.monitors)
  }

  save(monitors: StoredMonitor[]) {
    this.monitors = structuredClone(monitors)
    this.ensureDirectory()
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`
    try {
      writeFileSync(temporaryPath, JSON.stringify({ version: 1, monitors: this.monitors }), 'utf8')
      try {
        renameSync(temporaryPath, this.filePath)
      } catch (error) {
        // Windows cannot replace an existing file with renameSync. The temp
        // file is complete before the short replacement window begins.
        if (
          (error as NodeJS.ErrnoException).code !== 'EEXIST' &&
          (error as NodeJS.ErrnoException).code !== 'EPERM'
        )
          throw error
        unlinkSync(this.filePath)
        renameSync(temporaryPath, this.filePath)
      }
      this.loaded = true
    } finally {
      try {
        unlinkSync(temporaryPath)
      } catch {
        // The temp file was already renamed or could not be created.
      }
    }
  }

  private ensureLoaded() {
    if (this.loaded) return
    this.loaded = true
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as StorageFile
      const rawMonitors =
        parsed && parsed.version === 1 && Array.isArray(parsed.monitors) ? parsed.monitors : []
      const now = Date.now()
      let expired = false
      this.monitors = rawMonitors.flatMap((value) => {
        const monitor = validateMonitor(value)
        if (!monitor) return []
        if (monitor.status === 'active' && new Date(monitor.expiresAt).getTime() <= now) {
          monitor.status = 'expired'
          expired = true
        }
        return [monitor]
      })
      if (expired) this.save(this.monitors)
    } catch {
      // Missing, malformed, or unreadable local state must never stop the API.
      this.monitors = []
    }
  }

  private ensureDirectory() {
    mkdirSync(dirname(this.filePath), { recursive: true })
  }
}

function validateMonitor(value: unknown): StoredMonitor | null {
  if (!record(value)) return null
  const connectors: ConnectorType[] = ['CCS2', 'Type 2', 'CHAdeMO']
  const statuses = ['active', 'expired', 'stopped'] as const
  if (
    typeof value.id !== 'string' ||
    typeof value.stationId !== 'string' ||
    !connectors.includes(value.connector as ConnectorType) ||
    !statuses.includes(value.status as (typeof statuses)[number]) ||
    !validDate(value.createdAt) ||
    !validDate(value.expiresAt) ||
    !validDate(value.lastCheckedAt) ||
    (value.lastKnownAvailability !== null && typeof value.lastKnownAvailability !== 'number') ||
    !Array.isArray(value.events)
  )
    return null
  const events = value.events.filter(validateEvent)
  return {
    id: value.id,
    stationId: value.stationId,
    connector: value.connector as ConnectorType,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    lastCheckedAt: value.lastCheckedAt,
    lastKnownAvailability: value.lastKnownAvailability,
    status: value.status as StoredMonitor['status'],
    events,
  }
}

function validateEvent(value: unknown): value is StoredMonitorEvent {
  if (!record(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.message === 'string' &&
    validDate(value.timestamp) &&
    ['started', 'availability_changed', 'alternative_accepted', 'stale_warning'].includes(String(value.type))
  )
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

function record(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
