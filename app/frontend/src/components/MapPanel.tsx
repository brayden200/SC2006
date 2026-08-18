import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { Station } from '../types';

export function MapPanel({ stations, selectedId, onSelect, location }: { stations: Station[]; selectedId?: string; onSelect: (station: Station) => void; location: { latitude: number; longitude: number; label?: string } }) {
  const bounds = {
    minLat: Math.min(location.latitude, ...stations.map((item) => item.latitude)) - 0.006,
    maxLat: Math.max(location.latitude, ...stations.map((item) => item.latitude)) + 0.006,
    minLng: Math.min(location.longitude, ...stations.map((item) => item.longitude)) - 0.006,
    maxLng: Math.max(location.longitude, ...stations.map((item) => item.longitude)) + 0.006,
  };
  const position = (lat: number, lng: number) => ({
    left: `${8 + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1)) * 84}%`,
    top: `${8 + (1 - (lat - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1)) * 84}%`,
  });

  return (
    <div className="map-panel">
      <div className="map-road road-a" /><div className="map-road road-b" /><div className="map-road road-c" /><div className="map-road road-d" />
      <div className="map-water">MARINA BAY</div>
      <div className="map-label map-label-a">ORCHARD</div><div className="map-label map-label-b">CITY HALL</div>
      <span className="location-pulse" style={position(location.latitude, location.longitude)} title={location.label}><span /></span>
      {stations.map((station, index) => {
        const connector = station.connectors[0];
        const available = station.connectors.some((item) => (item.available ?? 0) > 0);
        return (
          <button
            key={station.id}
            className={`map-pin ${selectedId === station.id ? 'selected' : ''} ${available ? '' : 'busy'}`}
            style={position(station.latitude, station.longitude)}
            onClick={() => onSelect(station)}
            aria-label={`View ${station.name}`}
          >
            <span>{index + 1}</span>
            <div className="map-tooltip"><b>{station.name}</b><small>{connector.available ?? '?'} available · {connector.powerKw} kW</small></div>
          </button>
        );
      })}
      <div className="map-controls"><button aria-label="Zoom in"><Plus size={17} /></button><button aria-label="Zoom out"><Minus size={17} /></button><button aria-label="My location"><LocateFixed size={17} /></button></div>
      <div className="map-legend"><span><i className="legend-available" /> Available</span><span><i className="legend-busy" /> Busy</span><span><i className="legend-you" /> You</span></div>
    </div>
  );
}
