import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Loader, SimpleGrid } from '@mantine/core'
import {
  AlertTriangle,
  BellRing,
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
  const [findingAlternatives, setFindingAlternatives] = useState<string>()
  const [switchingTo, setSwitchingTo] = useState<string>()
  const [alternatives, setAlternatives] = useState<AlternativesResponse | null>(null)
  const [alternativeMonitor, setAlternativeMonitor] = useState<Monitor | null>(null)

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
    setFindingAlternatives(monitor.id)
    setAlternatives(null)
    setAlternativeMonitor(null)
    try {
      if (!navigator.geolocation) {
        throw new Error('Current location is unavailable in this browser.')
      }
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 30_000,
          timeout: 15_000,
        })
      }).catch((reason: GeolocationPositionError) => {
        if (reason.code === reason.PERMISSION_DENIED) {
          throw new Error('Allow location access to find alternatives near you.')
        }
        throw new Error('Could not determine your current location. Please try again.')
      })
      const result = await api.getAlternatives(
        monitor.id,
        position.coords.latitude,
        position.coords.longitude,
      )
      setAlternatives(result)
      setAlternativeMonitor(monitor)
    } catch (reason) {
      notify((reason as Error).message)
    } finally {
      setFindingAlternatives(undefined)
    }
  }
  const accept = async (stationId: string) => {
    if (!alternativeMonitor) return
    setSwitchingTo(stationId)
    try {
      const updated = await api.acceptAlternative(alternativeMonitor.id, stationId)
      setAlternatives(null)
      setAlternativeMonitor(null)
      await load(true)
      notify(`Switched monitoring to ${updated.station.name}`)
    } catch (reason) {
      notify((reason as Error).message)
    } finally {
      setSwitchingTo(undefined)
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
      </section>

      <Alert className="monitor-info" color="green" icon={<Radio size={17} />}>
        <span>
          <b>Automatic monitoring every 30 seconds</b> using the latest provider snapshot. This page refreshes
          every 15 seconds. Monitoring runs only while the local ChargeWise backend is running.
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
        <SimpleGrid className="monitor-grid" cols={2} spacing={16}>
          {active.map((monitor) => {
            const connector = monitor.station.connectors.find((item) => item.type === monitor.connector)!
            const latestChange = monitor.events.find((item) => item.type === 'availability_changed')
            const unavailable = (connector.available ?? 0) === 0
            return (
              <Card
                component="article"
                className={`monitor-card ${unavailable ? 'monitor-alert' : ''}`}
                key={monitor.id}
                padding={0}
              >
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
                  <Badge className={`status-badge ${unavailable ? 'danger' : ''}`} unstyled>
                    {unavailable ? 'Fully occupied' : `${connector.available ?? 'Unknown'} available`}
                  </Badge>
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
                    disabled={findingAlternatives === monitor.id}
                    leftSection={<RefreshCw size={16} />}
                    onClick={() => void check(monitor)}
                  >
                    Check now
                  </Button>
                  <Button
                    disabled={checking === monitor.id}
                    loading={findingAlternatives === monitor.id}
                    leftSection={<Route size={17} />}
                    onClick={() => void findAlternatives(monitor)}
                  >
                    Find alternatives near me
                  </Button>
                </div>
              </Card>
            )
          })}
        </SimpleGrid>
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
          title="Alternative chargers"
          subtitle={alternatives.message}
          onClose={() => {
            setAlternatives(null)
            setAlternativeMonitor(null)
          }}
          wide
          mobileFullScreen
        >
          {alternatives.alternatives.length === 0 ? (
            <div className="empty-state compact">
              <Route size={30} />
              <h3>No available alternative</h3>
              <p>{alternatives.message}</p>
            </div>
          ) : (
            <div className="alternative-list">
              {alternatives.alternatives.map((station, index) => {
                const plug = station.connectors.find((item) => item.type === alternativeMonitor.connector)!
                return (
                  <Card component="article" key={station.id} className={index === 0 ? 'recommended-alt' : ''}>
                    {index === 0 && (
                      <Badge className="best-ribbon" unstyled leftSection={<Zap size={13} />}>
                        Best alternative
                      </Badge>
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
                    <Button
                      loading={switchingTo === station.id}
                      disabled={Boolean(switchingTo) && switchingTo !== station.id}
                      onClick={() => void accept(station.id)}
                    >
                      Switch monitoring
                    </Button>
                  </Card>
                )
              })}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
