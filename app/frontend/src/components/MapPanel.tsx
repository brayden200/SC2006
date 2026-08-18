import { useEffect, useMemo, useState } from 'react';
import { LatLngBounds, divIcon, point, type Map as LeafletMap } from 'leaflet';
import { CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { Station } from '../types';

interface MapLocation {
  latitude: number;
  longitude: number;
  label?: string;
}

interface MapPanelProps {
  stations: Station[];
  selectedId?: string;
  onSelect: (station: Station) => void;
  location: MapLocation;
  currentLocation?: Pick<MapLocation, 'latitude' | 'longitude'>;
}

function MapViewport({ stations, location }: { stations: Station[]; location: MapLocation }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [
      [location.latitude, location.longitude],
      ...stations.map((station) => [station.latitude, station.longitude] as [number, number]),
    ];

    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }

    map.fitBounds(new LatLngBounds(points), {
      animate: false,
      maxZoom: 15,
      padding: [46, 46],
    });
  }, [location.latitude, location.longitude, map, stations]);

  return null;
}

function stationIcon(rank: number, available: boolean, selected: boolean) {
  return divIcon({
    className: 'station-marker-shell',
    html: `<span class="station-marker ${available ? 'available' : 'busy'} ${selected ? 'selected' : ''}">${rank}</span>`,
    iconAnchor: [18, 42],
    iconSize: [36, 42],
    tooltipAnchor: [0, -36],
  });
}

export function MapPanel({ stations, selectedId, onSelect, location, currentLocation }: MapPanelProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    if (!map) return;
    const syncZoom = () => setZoom(map.getZoom());
    syncZoom();
    map.on('zoomend', syncZoom);
    return () => { map.off('zoomend', syncZoom); };
  }, [map]);

  const icons = useMemo(() => stations.map((station, index) => {
    const available = station.connectors.some((connector) => (connector.available ?? 0) > 0);
    return stationIcon(index + 1, available, selectedId === station.id);
  }), [selectedId, stations]);

  const zoomIn = () => map?.zoomIn();
  const zoomOut = () => map?.zoomOut();
  const recenter = () => currentLocation && map?.flyTo(
    [currentLocation.latitude, currentLocation.longitude],
    Math.max(map.getZoom(), 15),
    { duration: 0.65 },
  );

  return (
    <div className="map-panel" role="region" aria-label={`Interactive charger map near ${location.label ?? 'your search location'}`}>
      <MapContainer
        center={[location.latitude, location.longitude]}
        zoom={13}
        zoomControl={false}
        scrollWheelZoom
        ref={(nextMap) => setMap(nextMap)}
        className="interactive-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapViewport stations={stations} location={location} />

        {currentLocation && <>
          <CircleMarker
            center={[currentLocation.latitude, currentLocation.longitude]}
            radius={9}
            pathOptions={{ color: '#ffffff', fillColor: '#3784cf', fillOpacity: 1, weight: 3 }}
            interactive={false}
            className="current-location-marker"
          />
          <CircleMarker
            center={[currentLocation.latitude, currentLocation.longitude]}
            radius={18}
            pathOptions={{ color: '#3784cf', fillColor: '#3784cf', fillOpacity: 0.09, weight: 1 }}
            interactive={false}
          />
        </>}

        {stations.map((station, index) => {
          const connector = station.connectors[0];
          const selected = selectedId === station.id;
          return (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={icons[index]}
              zIndexOffset={selected ? 1000 : 0}
              title={`View ${station.name}`}
              alt={`${station.name} charger`}
              eventHandlers={{ click: () => onSelect(station) }}
            >
              <Tooltip
                direction="top"
                offset={point(0, -2)}
                opacity={1}
                permanent={selected}
                className="station-map-tooltip"
              >
                <b>{station.name}</b>
                <span>{connector?.available ?? 'Unknown'} available · {connector?.powerKw ?? '—'} kW</span>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="map-controls" aria-label="Map controls">
        <button type="button" onClick={zoomIn} disabled={!map || zoom >= map.getMaxZoom()} aria-label="Zoom in" title="Zoom in">
          <Plus size={17} />
        </button>
        <button type="button" onClick={zoomOut} disabled={!map || zoom <= map.getMinZoom()} aria-label="Zoom out" title="Zoom out">
          <Minus size={17} />
        </button>
        <button type="button" onClick={recenter} disabled={!map || !currentLocation} aria-label="Recenter on my location" title={currentLocation ? 'Recenter on my location' : 'Current location unavailable'}>
          <LocateFixed size={17} />
        </button>
      </div>

      <div className="map-search-label" title={location.label}>
        <LocateFixed size={13} />
        <span>Search center</span>
        <b>{location.label ?? 'Selected location'}</b>
      </div>
      <div className="map-legend">
        <span><i className="legend-available" /> Available</span>
        <span><i className="legend-busy" /> Busy</span>
        {currentLocation && <span><i className="legend-you" /> Your location</span>}
      </div>
    </div>
  );
}
