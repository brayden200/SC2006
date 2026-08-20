import { ConfigService } from '@nestjs/config'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MonitorRepository } from './monitoring.repository'

describe('MonitorRepository', () => {
  let directory: string
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'chargewise-monitor-'))
  })
  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  it('persists and reloads valid monitors while expiring stale active records', () => {
    const repository = new MonitorRepository(new ConfigService({ CHARGEWISE_DATA_DIR: directory }))
    repository.save([
      {
        id: 'watch-1',
        stationId: 'station-1',
        connector: 'CCS2',
        createdAt: '2026-08-20T00:00:00.000Z',
        expiresAt: '2026-08-19T00:00:00.000Z',
        lastCheckedAt: '2026-08-19T00:00:00.000Z',
        lastKnownAvailability: 1,
        status: 'active',
        events: [
          { id: 'event-1', type: 'started', message: 'started', timestamp: '2026-08-19T00:00:00.000Z' },
        ],
      },
    ])
    const reloaded = new MonitorRepository(new ConfigService({ CHARGEWISE_DATA_DIR: directory })).getAll()
    expect(reloaded[0].status).toBe('expired')
    expect(reloaded[0].events).toHaveLength(1)
  })

  it('fails safely on malformed local storage', () => {
    const repository = new MonitorRepository(new ConfigService({ CHARGEWISE_DATA_DIR: directory }))
    writeFileSync(repository.filePath, '{not-json', 'utf8')
    expect(repository.getAll()).toEqual([])
  })
})
