import { Button } from '@mantine/core'
import { BatteryCharging, Check, ChevronRight, Clock3, Gauge, MapPin, Scale, Sparkles } from 'lucide-react'
import { formatPrice, timeAgo } from '../lib'
import type { ConnectorPreference, RankedStation } from '../types'

interface Props {
  station: RankedStation
  connector: ConnectorPreference
  rank: number
  best?: boolean
  compared: boolean
  onCompare: () => void
  onDetails: () => void
  onMonitor: () => void
  onHover: () => void
}

export function StationCard({
  station,
  connector,
  rank,
  best,
  compared,
  onCompare,
  onDetails,
  onMonitor,
  onHover,
}: Props) {
  const selectedConnector =
    station.selectedConnector ?? (connector === 'Any' ? station.connectors[0]?.type : connector)
  const plug = station.connectors.find((item) => item.type === selectedConnector)
  if (!plug) return null
  const isAvailable = plug.status === 'available' && (plug.available ?? 0) > 0
  return (
    <article className={`station-card ${best ? 'best-station' : ''}`} onMouseEnter={onHover}>
      {best && (
        <div className="best-ribbon">
          <Sparkles size={14} /> Best match
        </div>
      )}
      <div className="station-main-row">
        <div className="rank-badge">{rank}</div>
        <div className="station-title">
          <h3>{station.name}</h3>
          <p>
            <MapPin size={14} /> {station.address} · {station.distanceKm.toFixed(1)} km
          </p>
        </div>
        <div className="score-ring">
          <b>{station.score}</b>
          <span>score</span>
        </div>
      </div>
      <div className="station-metrics">
        <div>
          <span className={`availability-pill ${isAvailable ? '' : 'busy'}`}>
            <i /> {plug.available ?? 'Unknown'} available
          </span>
          <small>
            of {plug.total} · {timeAgo(station.lastUpdated)}
          </small>
        </div>
        <div>
          <Gauge size={17} />
          <b>{plug.powerKw > 0 ? `${plug.powerKw} kW` : 'Unknown'}</b>
          <small>
            {station.estimatedChargeMinutes === null
              ? 'Time unknown'
              : `${station.estimatedChargeMinutes} min est.`}
          </small>
        </div>
        <div>
          <Clock3 size={17} />
          <b>{station.travelMinutes ?? '—'} min</b>
          <small>
            {station.travelSource === 'OneMap'
              ? 'OneMap road route'
              : `${station.distanceKm.toFixed(1)} km straight-line estimate · not road time`}
          </small>
        </div>
        <div>
          <BatteryCharging size={17} />
          <b>
            {station.estimatedTotalCost !== null
              ? `$${station.estimatedTotalCost.toFixed(2)} total`
              : station.estimatedCost !== null
                ? `$${station.estimatedCost.toFixed(2)} charge`
                : formatPrice(station.pricePerKwh)}
          </b>
          <small>
            {station.estimatedTotalCost !== null
              ? 'Total visit estimate'
              : station.parkingEstimateStatus === 'rate_only'
                ? 'See parking rate'
                : station.parkingEstimateStatus === 'unavailable'
                  ? 'Parking unavailable'
                  : station.estimatedCost === null
                    ? 'Cost unknown'
                    : 'Charging estimate'}
          </small>
        </div>
      </div>
      <div className="reason-row">
        <div>
          {station.reasons.slice(0, 2).map((reason) => (
            <span key={reason}>
              <Check size={13} />
              {reason}
            </span>
          ))}
        </div>
        <span className="operator-tag">{station.operator}</span>
      </div>
      <div className="station-actions">
        <Button
          variant={compared ? 'light' : 'default'}
          size="xs"
          leftSection={<Scale size={16} />}
          onClick={onCompare}
        >
          {compared ? 'Selected' : 'Compare'}
        </Button>
        <Button variant="subtle" size="xs" rightSection={<ChevronRight size={15} />} onClick={onDetails}>
          Details
        </Button>
        <Button variant="light" size="xs" onClick={onMonitor}>
          Monitor
        </Button>
      </div>
    </article>
  )
}
