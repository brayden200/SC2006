import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Minus, Trophy } from 'lucide-react';
import { api, type CompareResponse } from '../api';
import { formatPrice } from '../lib';
import type { ConnectorType, RankedStation } from '../types';
import { Modal } from './Modal';

export function ComparisonModal({ stations, connector, energyKwh, location, onClose, onChoose }: { stations: RankedStation[]; connector: ConnectorType; energyKwh: number; location: { latitude: number; longitude: number }; onClose: () => void; onChoose: (station: RankedStation) => void }) {
  const [data, setData] = useState<CompareResponse | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api.compare({
      stationIds: stations.map((item) => item.id),
      connector,
      energyKwh,
      latitude: location.latitude,
      longitude: location.longitude,
    })
      .then(setData).catch((reason: Error) => setError(reason.message));
  }, [stations, connector, energyKwh, location]);

  const rows: Array<{ key: keyof NonNullable<CompareResponse['options'][number]>; label: string; value: (value: CompareResponse['options'][number]) => string }> = [
    { key: 'availability', label: 'Available now', value: (item) => item.availability === null ? 'Unknown' : `${item.availability} charger${item.availability === 1 ? '' : 's'}` },
    { key: 'powerKw', label: 'Charging speed', value: (item) => item.powerKw === null ? 'Unknown' : `${item.powerKw} kW` },
    { key: 'estimatedChargeMinutes', label: 'Est. charge time', value: (item) => item.estimatedChargeMinutes === null ? 'Unknown' : `${item.estimatedChargeMinutes} min` },
    { key: 'pricePerKwh', label: 'Price', value: (item) => item.pricePerKwh === null ? 'Unknown' : `${formatPrice(item.pricePerKwh)}/kWh` },
    { key: 'estimatedCost', label: `Est. cost (${energyKwh} kWh)`, value: (item) => formatPrice(item.estimatedCost) },
    { key: 'travelMinutes', label: 'Travel time', value: (item) => `${item.travelMinutes} min` },
    { key: 'travelSource', label: 'Travel data', value: (item) => item.travelSource },
    { key: 'operator', label: 'Operator', value: (item) => item.operator },
  ];

  return (
    <Modal title="Compare charging options" subtitle={`${connector} · estimates based on ${energyKwh} kWh added`} onClose={onClose} wide>
      {!data && !error && <div className="loading-state"><LoaderCircle className="spin" /> Comparing live options…</div>}
      {error && <div className="error-banner">{error}</div>}
      {data && (
        <div className="compare-scroll">
          <table className="comparison-table">
            <thead><tr><th>Compare</th>{data.options.map((item) => <th key={item.id}><b>{item.name}</b><span>{item.operator}</span></th>)}</tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th>{row.label}</th>
                  {data.options.map((item) => {
                    const highlight = data.highlights[row.key];
                    const best = highlight?.best.includes(item.id);
                    const weak = highlight?.weakest.includes(item.id) && !best;
                    return <td key={item.id} className={best ? 'cell-best' : weak ? 'cell-weak' : ''}>{best && <Trophy size={14} />}{weak && <Minus size={14} />}{row.value(item)}</td>;
                  })}
                </tr>
              ))}
              <tr className="choose-row"><th>Your choice</th>{data.options.map((item) => <td key={item.id}><button className="button secondary" onClick={() => onChoose(stations.find((station) => station.id === item.id)!)}><Check size={15} /> Choose</button></td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
