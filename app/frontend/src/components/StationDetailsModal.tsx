import { Badge, Button, Card } from '@mantine/core'
import { BatteryCharging, Database, MapPin, Navigation, PlugZap } from 'lucide-react'
import { timeAgo } from '../lib'
import type { RankedStation } from '../types'
import { Modal } from './Modal'

export function getRouteButtonLabel(routeVisible: boolean) {
  return routeVisible ? 'Change route' : 'Show route'
}

export function StationDetailsModal({
  station,
  onClose,
  onShowRoute,
  routeVisible = false,
  routeLoading = false,
  routeError = '',
}: {
  station: RankedStation
  onClose: () => void
  onShowRoute: () => void
  routeVisible?: boolean
  routeLoading?: boolean
  routeError?: string
}) {
  return (
    <Modal
      title={station.name}
      subtitle={`${station.operator} · ${station.postalCode}`}
      onClose={onClose}
      mobileFullScreen
      bodyClassName="station-detail-modal-body"
    >
      <div className="station-detail-content">
        <div className="detail-hero">
          <span>
            <MapPin size={19} />
          </span>
          <div>
            <b>{station.address}</b>
            <small>Singapore {station.postalCode}</small>
          </div>
          <Button
            variant="light"
            size="xs"
            leftSection={<Navigation size={16} />}
            onClick={onShowRoute}
            loading={routeLoading}
            aria-label={`${getRouteButtonLabel(routeVisible)} for ${station.name}`}
          >
            {getRouteButtonLabel(routeVisible)}
          </Button>
        </div>
        <h3 className="section-mini-title">Charging connectors</h3>
        <div className="connector-list">
          {station.connectors.map((item) => (
            <Card
              className={`connector-item ${item.type === station.selectedConnector ? 'selected' : ''}`}
              key={item.type}
              padding={0}
            >
              <PlugZap size={20} />
              <div>
                <b>{item.type}</b>
                <small>{item.powerKw} kW</small>
              </div>
              <Badge className={`availability-pill ${item.status !== 'available' ? 'busy' : ''}`} unstyled>
                <i />
                {item.available === null ? 'Unknown' : `${item.available} of ${item.total} available`}
              </Badge>
            </Card>
          ))}
        </div>
        <div className="details-grid">
          <Card padding={0}>
            <BatteryCharging />
            <span>Charging price</span>
            <b>
              {station.estimatedHourlyCost === null
                ? 'Unknown'
                : `$${station.estimatedHourlyCost.toFixed(2)}/hour`}
            </b>
            <small>
              {station.hourlyCostIncludesParking ? 'Includes 1 hour of parking' : 'Parking not included'}
            </small>
          </Card>
          <Card padding={0}>
            <Database />
            <span>Data source</span>
            <b>{station.source}</b>
          </Card>
          <Card padding={0}>
            <Navigation />
            <span>Travel time</span>
            <b>
              {routeLoading
                ? 'Loading…'
                : station.travelMinutes === null
                  ? 'Unavailable'
                  : `${station.travelMinutes} min`}
            </b>
            <small className="travel-source-note">
              {station.travelSource === 'OneMap'
                ? 'OneMap road route'
                : 'Straight-line estimate — not road travel time'}
            </small>
          </Card>
        </div>
        {routeError && (
          <div className="data-note route-error-note" role="alert">
            <Navigation size={16} />
            <div>
              <b>Road route unavailable</b>
              <p>
                {routeError}{' '}
                {station.travelSource === 'OneMap'
                  ? 'The OneMap travel time remains available, but the road line could not be drawn.'
                  : 'The displayed fallback is clearly marked as a straight-line estimate.'}
              </p>
            </div>
          </div>
        )}
        <div className="parking-detail">
          <b>Parking</b>
          <p>
            {station.parking?.publishedRateText ?? 'Parking information is unavailable for this station.'}
          </p>
          {station.parking && (
            <small>
              {station.parking.sourceName} · Updated {timeAgo(station.parking.lastUpdated)} ·{' '}
              {station.parking.associationLabel}
            </small>
          )}
        </div>
        <div className="data-note">
          <Database size={16} />
          <div>
            <b>Updated {timeAgo(station.lastUpdated)}</b>
            <p>
              Hourly cost uses the published rate, connector power, and one hour of parking when an official
              tariff is available. Availability may change before you arrive.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}
