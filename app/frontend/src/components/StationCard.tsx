import { BatteryCharging, Check, ChevronRight, Clock3, Gauge, MapPin, Scale, Sparkles } from 'lucide-react';
import { formatPrice, hasKnownPrice, timeAgo } from '../lib';
import type { ConnectorType, RankedStation } from '../types';

interface Props {
  station: RankedStation;
  connector: ConnectorType;
  rank: number;
  best?: boolean;
  compared: boolean;
  onCompare: () => void;
  onDetails: () => void;
  onMonitor: () => void;
  onPredict: () => void;
  onHover: () => void;
}

export function StationCard({ station, connector, rank, best, compared, onCompare, onDetails, onMonitor, onPredict, onHover }: Props) {
  const plug = station.connectors.find((item) => item.type === connector);
  if (!plug) return null;
  const isAvailable = plug.status === 'available' && (plug.available ?? 0) > 0;
  return (
    <article className={`station-card ${best ? 'best-station' : ''}`} onMouseEnter={onHover}>
      {best && <div className="best-ribbon"><Sparkles size={14} /> Best match</div>}
      <div className="station-main-row">
        <div className="rank-badge">{rank}</div>
        <div className="station-title">
          <h3>{station.name}</h3>
          <p><MapPin size={14} /> {station.address} · {station.distanceKm.toFixed(1)} km</p>
        </div>
        <div className="score-ring"><b>{station.score}</b><span>score</span></div>
      </div>
      <div className="station-metrics">
        <div><span className={`availability-pill ${isAvailable ? '' : 'busy'}`}><i /> {plug.available ?? 'Unknown'} available</span><small>of {plug.total} · {timeAgo(station.lastUpdated)}</small></div>
        <div><Gauge size={17} /><b>{plug.powerKw > 0 ? `${plug.powerKw} kW` : 'Unknown'}</b><small>{station.estimatedChargeMinutes === null ? 'Time unknown' : `${station.estimatedChargeMinutes} min est.`}</small></div>
        <div><Clock3 size={17} /><b>{station.travelMinutes ?? '—'} min</b><small>{station.travelSource === 'OneMap' ? 'OneMap route' : `${station.distanceKm.toFixed(1)} km est.`}</small></div>
        <div><BatteryCharging size={17} /><b>{formatPrice(station.pricePerKwh)}{hasKnownPrice(station.pricePerKwh) && '/kWh'}</b><small>{station.estimatedCost === null ? 'Cost unknown' : `$${station.estimatedCost.toFixed(2)} est.`}</small></div>
      </div>
      <div className="reason-row">
        <div>{station.reasons.slice(0, 2).map((reason) => <span key={reason}><Check size={13} />{reason}</span>)}</div>
        <span className="operator-tag">{station.operator}</span>
      </div>
      <div className="station-actions">
        <button className={`compare-toggle ${compared ? 'checked' : ''}`} onClick={onCompare}><Scale size={16} />{compared ? 'Selected' : 'Compare'}</button>
        <button className="text-button" onClick={onPredict}>Predict availability</button>
        <button className="text-button" onClick={onDetails}>Details <ChevronRight size={15} /></button>
        <button className="button secondary" onClick={onMonitor}>Monitor</button>
      </div>
    </article>
  );
}
