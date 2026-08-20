import { Button } from '@mantine/core'
import { BatteryCharging, Database, MapPin, Navigation, PlugZap } from 'lucide-react'
import { formatPrice, hasKnownPrice, timeAgo } from '../lib'
import type { ConnectorType, RankedStation } from '../types'
import { Modal } from './Modal'

export function buildGoogleMapsDrivingUrl(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: 'driving',
  })
  return `https://www.google.com/maps/dir/?${params}`
}

export function StationDetailsModal({
  station,
  connector,
  origin,
  onClose,
  onMonitor,
  onSelectRoute,
  routeLoading = false,
  routeError = '',
}: {
  station: RankedStation
  connector: ConnectorType
  origin: { latitude: number; longitude: number }
  onClose: () => void
  onMonitor: () => void
  onSelectRoute?: () => void
  routeLoading?: boolean
  routeError?: string
}) {
  const openDirections = () => {
    onSelectRoute?.()
    window.open(buildGoogleMapsDrivingUrl(origin, station), '_blank', 'noopener,noreferrer')
  }

  return (
    <Modal title={station.name} subtitle={`${station.operator} · ${station.postalCode}`} onClose={onClose}>
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
          onClick={openDirections}
          aria-label={`Get driving directions to ${station.name}`}
        >
          Directions
        </Button>
      </div>
      <h3 className="section-mini-title">Charging connectors</h3>
      <div className="connector-list">
        {station.connectors.map((item) => (
          <div className={`connector-item ${item.type === connector ? 'selected' : ''}`} key={item.type}>
            <PlugZap size={20} />
            <div>
              <b>{item.type}</b>
              <small>{item.powerKw} kW</small>
            </div>
            <span className={`availability-pill ${item.status !== 'available' ? 'busy' : ''}`}>
              <i />
              {item.available === null ? 'Unknown' : `${item.available} of ${item.total} available`}
            </span>
          </div>
        ))}
      </div>
      <div className="details-grid">
        <div>
          <BatteryCharging />
          <span>Price</span>
          <b>{hasKnownPrice(station.pricePerKwh) ? `${formatPrice(station.pricePerKwh)}/kWh` : 'Unknown'}</b>
        </div>
        <div>
          <Database />
          <span>Data source</span>
          <b>{station.source}</b>
        </div>
        <div>
          <MapPin />
          <span>Charging estimate</span>
          <b>{station.estimatedCost === null ? 'Unknown' : `$${station.estimatedCost.toFixed(2)}`}</b>
        </div>
        <div>
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
        </div>
        <div>
          <MapPin />
          <span>Parking estimate</span>
          <b>
            {station.estimatedParkingCost === null
              ? 'Unavailable'
              : `$${station.estimatedParkingCost.toFixed(2)}`}
          </b>
        </div>
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
        <p>{station.parking?.publishedRateText ?? 'Parking information is unavailable for this station.'}</p>
        {station.parking && (
          <small>
            {station.parking.sourceName} · Updated {timeAgo(station.parking.lastUpdated)} ·{' '}
            {station.parking.associationLabel}
          </small>
        )}
      </div>
      <div className="total-detail">
        <span>Estimated total visit cost</span>
        <b>
          {station.estimatedTotalCost === null ? 'Unavailable' : `$${station.estimatedTotalCost.toFixed(2)}`}
        </b>
      </div>
      <div className="data-note">
        <Database size={16} />
        <div>
          <b>Updated {timeAgo(station.lastUpdated)}</b>
          <p>
            Charging and parking costs are estimates for the planned charging duration. Availability may
            change before you arrive.
          </p>
        </div>
      </div>
      <Button fullWidth onClick={onMonitor}>
        Monitor this {connector} charger
      </Button>
    </Modal>
  )
}
