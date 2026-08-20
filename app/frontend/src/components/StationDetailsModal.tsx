import { Button } from '@mantine/core'
import { BatteryCharging, Database, MapPin, Navigation, PlugZap } from 'lucide-react'
import { formatPrice, hasKnownPrice, timeAgo } from '../lib'
import type { ConnectorType, RankedStation } from '../types'
import { Modal } from './Modal'

export function StationDetailsModal({
  station,
  connector,
  onClose,
  onMonitor,
}: {
  station: RankedStation
  connector: ConnectorType
  onClose: () => void
  onMonitor: () => void
}) {
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
        <Button variant="light" size="xs" leftSection={<Navigation size={16} />}>
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
          <MapPin />
          <span>Parking estimate</span>
          <b>
            {station.estimatedParkingCost === null
              ? 'Unavailable'
              : `$${station.estimatedParkingCost.toFixed(2)}`}
          </b>
        </div>
      </div>
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
