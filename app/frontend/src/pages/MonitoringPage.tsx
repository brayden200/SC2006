import { useEffect, useState } from 'react'
import { Alert, Button, Loader, Switch } from '@mantine/core'
import {
  AlertTriangle,
  BellRing,
  CarFront,
  Check,
  Clock3,
  MapPin,
  Radio,
  RefreshCw,
  Route,
  ShieldAlert,
  Square,
  Zap,
} from 'lucide-react'
import { api, type AlternativesResponse } from '../api'
import { Modal } from '../components/Modal'
import { timeAgo } from '../lib'
import type { Monitor } from '../types'

export function MonitoringPage({ notify }: { notify: (message: string) => void }) {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState<string>()
  const [alternatives, setAlternatives] = useState<AlternativesResponse | null>(null)
  const [alternativeMonitor, setAlternativeMonitor] = useState<Monitor | null>(null)
  const [drivingMode, setDrivingMode] = useState(false)

  const load = async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      setMonitors((await api.getMonitors()).monitors)
    } catch (reason) {
      if (!quiet) notify((reason as Error).message)
    } finally {
      if (!quiet) setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(true), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const check = async (monitor: Monitor) => {
    setChecking(monitor.id)
    try {
      const updated = await api.checkMonitor(monitor.id)
      await load(true)
      const latest = updated.events[0]
      notify(latest.type === 'availability_changed' ? latest.message : 'Availability checked — no change')
    } catch (reason) {
      notify((reason as Error).message)
    } finally {
      setChecking(undefined)
    }
  }
  const findAlternatives = async (monitor: Monitor) => {
    setChecking(monitor.id)
    try {
      setAlternatives(await api.getAlternatives(monitor.id, 1.3048, 103.8318))
      setAlternativeMonitor(monitor)
    } catch (reason) {
      notify((reason as Error).message)
    } finally {
      setChecking(undefined)
    }
  }
  const accept = async (stationId: string) => {
    if (!alternativeMonitor) return
    try {
      const updated = await api.acceptAlternative(alternativeMonitor.id, stationId)
      setAlternatives(null)
      setAlternativeMonitor(null)
      await load(true)
      notify(`Switched monitoring to ${updated.station.name}`)
    } catch (reason) {
      notify((reason as Error).message)
    }
  }
  const stop = async (monitor: Monitor) => {
    try {
      await api.stopMonitor(monitor.id)
      await load(true)
      notify(`Stopped monitoring ${monitor.station.name}`)
    } catch (reason) {
      notify((reason as Error).message)
    }
  }

  const active = monitors.filter((item) => item.status === 'active')
  const past = monitors.filter((item) => item.status !== 'active')
  return (
    <div className="page monitoring-page">
      <section className="page-heading split-heading">
        <div>
          <span className="eyebrow">LIVE WATCHLIST</span>
          <h1>
            Stay ahead of <em>changing availability.</em>
          </h1>
          <p>We check your selected charger and flag changes before you arrive.</p>
        </div>
        <Switch
          className="driving-switch"
          checked={drivingMode}
          onChange={(event) => setDrivingMode(event.currentTarget.checked)}
          label="Driving mode"
          description="Simplified alerts"
          thumbIcon={<CarFront size={11} />}
        />
      </section>

      <Alert className="monitor-info" color="green" icon={<Radio size={17} />}>
        <span>
          <b>Automatic monitoring every 30 seconds</b> using the latest provider snapshot. This page refreshes
          every 15 seconds.
        </span>
      </Alert>
      {loading ? (
        <div className="page-loading">
          <Loader />
          <h3>Loading your watchlist…</h3>
        </div>
      ) : active.length === 0 ? (
        <div className="empty-state">
          <BellRing size={36} />
          <h2>No chargers being monitored</h2>
          <p>Find a compatible charger, then choose “Monitor” to watch it for changes.</p>
        </div>
      ) : (
        <div className="monitor-grid">
          {active.map((monitor) => {
            const connector = monitor.station.connectors.find((item) => item.type === monitor.connector)!
            const latestChange = monitor.events.find((item) => item.type === 'availability_changed')
            const unavailable = (connector.available ?? 0) === 0
            return (
              <article className={`monitor-card ${unavailable ? 'monitor-alert' : ''}`} key={monitor.id}>
                <div className="monitor-card-head">
                  <div className={`live-pulse ${unavailable ? 'danger' : ''}`}>
                    <span />
                  </div>
                  <div>
                    <small>MONITORING · {monitor.connector}</small>
                    <h2>{monitor.station.name}</h2>
                    <p>
                      <MapPin size={14} />
                      {monitor.station.address}
                    </p>
                  </div>
                  <span className={`status-badge ${unavailable ? 'danger' : ''}`}>
                    {unavailable ? 'Fully occupied' : `${connector.available ?? 'Unknown'} available`}
                  </span>
                </div>
                {latestChange && latestChange === monitor.events[0] && (
                  <div className={`change-alert ${unavailable ? 'danger' : ''}`}>
                    <AlertTriangle size={18} />
                    <div>
                      <b>Availability changed</b>
                      <p>{latestChange.message}</p>
                      <small>{timeAgo(latestChange.timestamp)}</small>
                    </div>
                  </div>
                )}
                <div className="monitor-stats">
                  <div>
                    <Zap size={18} />
                    <span>Charging speed</span>
                    <b>{connector.powerKw} kW</b>
                  </div>
                  <div>
                    <Clock3 size={18} />
                    <span>Last checked</span>
                    <b>{timeAgo(monitor.lastCheckedAt)}</b>
                  </div>
                  <div>
                    <ShieldAlert size={18} />
                    <span>Monitoring ends</span>
                    <b>
                      {new Date(monitor.expiresAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </b>
                  </div>
                </div>
                <div className="event-timeline">
                  <h3>Recent activity</h3>
                  {monitor.events.slice(0, 3).map((event) => (
                    <div key={event.id}>
                      <i className={event.type === 'availability_changed' ? 'change' : ''} />
                      <p>
                        {event.message}
                        <small>{timeAgo(event.timestamp)}</small>
                      </p>
                    </div>
                  ))}
                </div>
                <div className="monitor-actions">
                  <Button
                    variant="subtle"
                    color="red"
                    leftSection={<Square size={15} />}
                    onClick={() => void stop(monitor)}
                  >
                    Stop
                  </Button>
                  <Button
                    variant="light"
                    loading={checking === monitor.id}
                    leftSection={<RefreshCw size={16} />}
                    onClick={() => void check(monitor)}
                  >
                    Check now
                  </Button>
                  <Button
                    disabled={checking === monitor.id}
                    leftSection={<Route size={17} />}
                    onClick={() => void findAlternatives(monitor)}
                  >
                    Find alternative
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {past.length > 0 && (
        <section className="past-monitors">
          <h2>Previous monitoring</h2>
          {past.map((monitor) => (
            <div key={monitor.id}>
              <span>{monitor.station.name}</span>
              <small>
                {monitor.connector} · {monitor.status}
              </small>
            </div>
          ))}
        </section>
      )}

      {alternatives && alternativeMonitor && (
        <Modal
          title={drivingMode ? 'Safer charger available' : 'Alternative chargers'}
          subtitle={drivingMode ? 'One-tap decision for driving mode' : alternatives.message}
          onClose={() => {
            setAlternatives(null)
            setAlternativeMonitor(null)
          }}
          wide={!drivingMode}
        >
          {alternatives.alternatives.length === 0 ? (
            <div className="empty-state compact">
              <Route size={30} />
              <h3>No available alternative</h3>
              <p>{alternatives.message}</p>
            </div>
          ) : drivingMode ? (
            <div className="driving-alternative">
              <CarFront size={36} />
              <span>BEST ALTERNATIVE</span>
              <h2>{alternatives.recommended!.name}</h2>
              <p>
                {alternatives.recommended!.travelMinutes} min away · +
                {alternatives.recommended!.additionalTravelMinutes} min detour ·{' '}
                {
                  alternatives.recommended!.connectors.find(
                    (item) => item.type === alternativeMonitor.connector,
                  )?.available
                }{' '}
                available
              </p>
              <Button
                fullWidth
                leftSection={<Check size={18} />}
                onClick={() => void accept(alternatives.recommended!.id)}
              >
                Switch and keep monitoring
              </Button>
              <small>Only interact when it is safe to do so.</small>
            </div>
          ) : (
            <div className="alternative-list">
              {alternatives.alternatives.map((station, index) => {
                const plug = station.connectors.find((item) => item.type === alternativeMonitor.connector)!
                return (
                  <article key={station.id} className={index === 0 ? 'recommended-alt' : ''}>
                    {index === 0 && (
                      <span className="best-ribbon">
                        <Zap size={13} /> Best alternative
                      </span>
                    )}
                    <div>
                      <h3>{station.name}</h3>
                      <p>{station.address}</p>
                    </div>
                    <div className="alt-metrics">
                      <span>
                        <b>{plug.available}</b> available
                      </span>
                      <span>
                        <b>{station.travelMinutes} min</b> away
                      </span>
                      <span>
                        <b>+{station.additionalTravelMinutes} min</b> detour
                      </span>
                      <span>
                        <b>{plug.powerKw} kW</b> speed
                      </span>
                    </div>
                    <p className="alt-reason">{station.reasons[0]}</p>
                    <Button onClick={() => void accept(station.id)}>Switch monitoring</Button>
                  </article>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
