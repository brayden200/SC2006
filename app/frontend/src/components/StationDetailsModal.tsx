import { BatteryCharging, Database, MapPin, Navigation, PlugZap } from 'lucide-react';
import { formatPrice, timeAgo } from '../lib';
import type { ConnectorType, Station } from '../types';
import { Modal } from './Modal';

export function StationDetailsModal({ station, connector, onClose, onMonitor }: { station: Station; connector: ConnectorType; onClose: () => void; onMonitor: () => void }) {
  return (
    <Modal title={station.name} subtitle={`${station.operator} · ${station.postalCode}`} onClose={onClose}>
      <div className="detail-hero">
        <span><MapPin size={19} /></span><div><b>{station.address}</b><small>Singapore {station.postalCode}</small></div>
        <button className="button secondary"><Navigation size={16} /> Directions</button>
      </div>
      <h3 className="section-mini-title">Charging connectors</h3>
      <div className="connector-list">
        {station.connectors.map((item) => (
          <div className={`connector-item ${item.type === connector ? 'selected' : ''}`} key={item.type}>
            <PlugZap size={20} /><div><b>{item.type}</b><small>{item.powerKw} kW</small></div>
            <span className={`availability-pill ${item.status !== 'available' ? 'busy' : ''}`}><i />{item.available === null ? 'Unknown' : `${item.available} of ${item.total} available`}</span>
          </div>
        ))}
      </div>
      <div className="details-grid">
        <div><BatteryCharging /><span>Price</span><b>{station.pricePerKwh === null ? 'Unknown' : `${formatPrice(station.pricePerKwh)}/kWh`}</b></div>
        <div><Database /><span>Data source</span><b>{station.source}</b></div>
      </div>
      <div className="data-note"><Database size={16} /><div><b>Updated {timeAgo(station.lastUpdated)}</b><p>Availability is a snapshot and may change before you arrive.</p></div></div>
      <button className="button primary full-width" onClick={onMonitor}>Monitor this {connector} charger</button>
    </Modal>
  );
}
