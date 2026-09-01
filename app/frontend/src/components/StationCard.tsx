import { memo } from 'react'
import { Badge, Button, Card } from '@mantine/core'
import { BatteryCharging, Check, ChevronRight, Clock3, Gauge, MapPin, Sparkles } from 'lucide-react'
import { timeAgo } from '../lib'
import type { ConnectorPreference, RankedStation } from '../types'

interface Props {
  station: RankedStation
  connector: ConnectorPreference
  rank: number
  best?: boolean
  onDetails: (station: RankedStation) => void
  onHover: (id: string) => void
}

export function getCardRoadTravel(
  station: Pick<RankedStation, 'distanceKm' | 'travelMinutes' | 'travelSource'>,
) {
  const hasOneMapRoute = station.travelSource === 'OneMap' && station.travelMinutes !== null
  return {
    distanceLabel: hasOneMapRoute ? `${station.distanceKm.toFixed(1)} km road` : '',
    minutesLabel: hasOneMapRoute ? `${station.travelMinutes} min` : '—',
    sourceLabel: hasOneMapRoute ? 'OneMap road route' : 'Road route unavailable',
  }
}

export const StationCard = memo(function StationCard({
  station,
  connector,
  rank,
  best,
  onDetails,
  onHover,
}: Props) {
  const selectedConnector =
    station.selectedConnector ?? (connector === 'Any' ? station.connectors[0]?.type : connector)
  const plug = station.connectors.find((item) => item.type === selectedConnector)
  if (!plug) return null
  const isAvailable = plug.status === 'available' && (plug.available ?? 0) > 0
  const roadTravel = getCardRoadTravel(station)
  return (
    <Card
      component="article"
      className={`station-card ${best ? 'best-station' : ''}`}
      onMouseEnter={() => onHover(station.id)}
      padding={0}
    >
      {best && (
        <Badge className="best-ribbon" unstyled leftSection={<Sparkles size={14} />}>
          Best match
        </Badge>
      )}
      <div className="station-main-row">
        <Badge className="rank-badge" unstyled>
          {rank}
        </Badge>
        <div className="station-title">
          <h3>{station.name}</h3>
          <p>
            <MapPin size={14} /> {station.address}
            {roadTravel.distanceLabel ? ` · ${roadTravel.distanceLabel}` : ''}
          </p>
        </div>
        <div className="score-ring">
          <b>{station.score}</b>
          <span>score</span>
        </div>
      </div>
      <div className="station-metrics">
        <div>
          <Badge className={`availability-pill ${isAvailable ? '' : 'busy'}`} unstyled>
            <i /> {plug.available ?? 'Unknown'} available
          </Badge>
          <small>
            of {plug.total} · {timeAgo(station.lastUpdated)}
          </small>
        </div>
        <div>
          <Gauge size={17} />
          <b>{plug.powerKw > 0 ? `${plug.powerKw} kW` : 'Unknown'}</b>
          <small>Charging power</small>
        </div>
        <div>
          <Clock3 size={17} />
          <b>{roadTravel.minutesLabel}</b>
          <small>{roadTravel.sourceLabel}</small>
        </div>
        <div>
          <BatteryCharging size={17} />
          <b>
            {station.estimatedHourlyCost === null
              ? 'Unknown'
              : `$${station.estimatedHourlyCost.toFixed(2)}/hr`}
          </b>
          <small>
            {station.hourlyCostIncludesParking
              ? 'Charging + parking per hour'
              : station.parking
                ? 'Charging per hour · parking unknown'
                : 'Charging per hour'}
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
        <Badge className="operator-tag" unstyled>
          {station.operator}
        </Badge>
      </div>
      <div className="station-actions">
        <Button
          variant="default"
          size="xs"
          rightSection={<ChevronRight size={15} />}
          onClick={() => onDetails(station)}
        >
          Details
        </Button>
      </div>
    </Card>
  )
})
