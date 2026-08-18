import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, CircleAlert, Filter, LoaderCircle, LocateFixed, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../api';
import { ComparisonModal } from '../components/ComparisonModal';
import { MapPanel } from '../components/MapPanel';
import { PredictionModal } from '../components/PredictionModal';
import { StationCard } from '../components/StationCard';
import { StationDetailsModal } from '../components/StationDetailsModal';
import type { ConnectorType, Page, RankedStation, RecommendationResponse, SearchResponse, Station } from '../types';

const weightSets = {
  Balanced: { availabilityWeight: 30, travelWeight: 25, speedWeight: 20, priceWeight: 15, preferenceWeight: 10 },
  Availability: { availabilityWeight: 50, travelWeight: 20, speedWeight: 15, priceWeight: 10, preferenceWeight: 5 },
  Speed: { availabilityWeight: 25, travelWeight: 20, speedWeight: 40, priceWeight: 10, preferenceWeight: 5 },
  Savings: { availabilityWeight: 25, travelWeight: 20, speedWeight: 10, priceWeight: 40, preferenceWeight: 5 },
};

export function ExplorePage({ navigate, notify }: { navigate: (page: Page) => void; notify: (message: string) => void }) {
  const [locationQuery, setLocationQuery] = useState('Orchard Road');
  const [connector, setConnector] = useState<ConnectorType>('CCS2');
  const [radiusKm, setRadiusKm] = useState(8);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [includeUnknown, setIncludeUnknown] = useState(false);
  const [minPowerKw, setMinPowerKw] = useState(0);
  const [maxPrice, setMaxPrice] = useState('');
  const [operator, setOperator] = useState('');
  const [priority, setPriority] = useState<keyof typeof weightSets>('Balanced');
  const [energyKwh, setEnergyKwh] = useState(35);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [details, setDetails] = useState<Station | null>(null);
  const [predicting, setPredicting] = useState<Station | null>(null);
  const [mapSelectedId, setMapSelectedId] = useState<string>();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const runSearch = async (initial = false) => {
    setLoading(true); setError(''); setCompareIds([]);
    try {
      const search = await api.searchStations({
        query: locationQuery, latitude: coords?.latitude, longitude: coords?.longitude,
        radiusKm, connector, availableOnly, includeUnknown, minPowerKw: minPowerKw || undefined,
        maxPrice: maxPrice || undefined, operator: operator || undefined,
      });
      setSearchResult(search);
      const ranked = await api.recommend({
        latitude: search.location.latitude, longitude: search.location.longitude, locationLabel: search.location.label,
        radiusKm, connector, energyKwh, maxPrice: maxPrice ? Number(maxPrice) : undefined,
        minPowerKw: minPowerKw || undefined, availableOnly, includeUnknown,
        operator: operator || undefined, preferredOperator: operator || undefined, ...weightSets[priority],
      });
      const allowed = new Set(search.stations.map((item) => item.id));
      ranked.ranked = ranked.ranked.filter((item) => allowed.has(item.id));
      ranked.recommended = ranked.ranked[0] ?? null;
      ranked.alternatives = ranked.ranked.slice(1, 3);
      setRecommendation(ranked);
      if (ranked.recommended) setMapSelectedId(ranked.recommended.id);
      if (!initial) notify(`${ranked.ranked.length} compatible station${ranked.ranked.length === 1 ? '' : 's'} found`);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void runSearch(true); }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Location is unavailable. Enter an address or postal code instead.'); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationQuery('My current location');
        notify('Current location added — press Search to refresh nearby stations');
      },
      () => setError('Location permission was denied. Enter an address or Singapore postal code instead.'),
    );
  };

  const ranked = recommendation?.ranked ?? [];
  const compared = ranked.filter((item) => compareIds.includes(item.id));
  const toggleCompare = (id: string) => {
    if (compareIds.includes(id)) setCompareIds((items) => items.filter((item) => item !== id));
    else if (compareIds.length < 4) setCompareIds((items) => [...items, id]);
    else notify('You can compare up to four stations at once');
  };
  const monitor = async (station: Station) => {
    try {
      await api.createMonitor(station.id, connector);
      notify(`Monitoring ${station.name} for 90 minutes`);
      setDetails(null); navigate('monitoring');
    } catch (reason) { notify((reason as Error).message); }
  };

  return (
    <div className="page explore-page">
      <section className="page-heading">
        <div><span className="eyebrow">INTELLIGENT CHARGER SEARCH</span><h1>Find your best charge, <em>not just the nearest.</em></h1><p>Live-style availability, travel time, speed and price—ranked around what matters to you.</p></div>
      </section>

      <section className="search-card">
        <div className="search-grid">
          <label className="location-field"><span>Where do you need to charge?</span><div><Search size={19} /><input value={locationQuery} onChange={(event) => { setLocationQuery(event.target.value); setCoords(null); }} placeholder="Address or postal code" /><button onClick={useMyLocation} aria-label="Use current location"><LocateFixed size={18} /></button></div></label>
          <label><span>Connector</span><div className="select-wrap"><select value={connector} onChange={(event) => setConnector(event.target.value as ConnectorType)}><option>CCS2</option><option>Type 2</option><option>CHAdeMO</option></select><ChevronDown size={16} /></div></label>
          <label><span>Ranking priority</span><div className="select-wrap"><select value={priority} onChange={(event) => setPriority(event.target.value as keyof typeof weightSets)}>{Object.keys(weightSets).map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></div></label>
          <button className="button primary search-button" onClick={() => void runSearch()} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <Search size={18} />} Search</button>
        </div>
        <div className="quick-filters">
          <button className={availableOnly ? 'active' : ''} onClick={() => setAvailableOnly((value) => !value)}><span className="toggle-dot" /> Available now</button>
          <button className={minPowerKw === 100 ? 'active' : ''} onClick={() => setMinPowerKw((value) => value === 100 ? 0 : 100)}>100+ kW fast</button>
          <button onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal size={15} /> All filters {filtersOpen ? <X size={14} /> : <Filter size={14} />}</button>
        </div>
        {filtersOpen && <div className="advanced-filters">
          <label>Search radius <b>{radiusKm} km</b><input type="range" min="2" max="25" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} /></label>
          <label>Energy to add <b>{energyKwh} kWh</b><input type="range" min="10" max="80" step="5" value={energyKwh} onChange={(event) => setEnergyKwh(Number(event.target.value))} /></label>
          <label>Maximum price<select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}><option value="">Any / unknown allowed</option><option value="0.50">Up to $0.50/kWh</option><option value="0.60">Up to $0.60/kWh</option><option value="0.70">Up to $0.70/kWh</option></select></label>
          <label>Operator<select value={operator} onChange={(event) => setOperator(event.target.value)}><option value="">Any operator</option><option>SP Mobility</option><option>Charge+</option><option>Shell Recharge</option><option>Bluecharge</option></select></label>
          <label className="checkbox-label"><input type="checkbox" checked={includeUnknown} onChange={(event) => setIncludeUnknown(event.target.checked)} /> Include unknown availability</label>
        </div>}
      </section>

      {error && <div className="error-banner"><CircleAlert size={18} />{error}</div>}
      {searchResult?.dataStatus.isCached ? <div className="cache-banner"><AlertTriangle size={16} /><span><b>Using cached demonstration data</b> · Updated {new Date(searchResult.dataStatus.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. {searchResult.dataStatus.fallbackReason || 'Live availability is never guaranteed.'}</span></div> : searchResult && <div className="cache-banner live-provider"><span className="provider-live-dot" /><span><b>Live LTA DataMall charging data</b> · Location and travel times use {searchResult.dataStatus.oneMap.state === 'available' ? 'OneMap' : 'the local fallback'}.</span></div>}

      {loading ? <div className="page-loading"><LoaderCircle className="spin" /><h3>Ranking compatible chargers…</h3><p>Balancing availability, travel, speed and price.</p></div> : ranked.length > 0 ? <>
        <div className="results-heading"><div><h2>{searchResult && searchResult.totalMatches > ranked.length ? `Top ${ranked.length} of ${searchResult.totalMatches}` : ranked.length} compatible options</h2><p>Near {searchResult?.location.label} · ranked for {priority.toLowerCase()}</p></div><span className="result-updated"><i /> Data checked just now</span></div>
        <div className="results-layout">
          <div className="station-list">
            {ranked.map((station, index) => <StationCard key={station.id} station={station} connector={connector} rank={index + 1} best={index === 0} compared={compareIds.includes(station.id)} onCompare={() => toggleCompare(station.id)} onDetails={() => setDetails(station)} onMonitor={() => void monitor(station)} onPredict={() => setPredicting(station)} onHover={() => setMapSelectedId(station.id)} />)}
          </div>
          <aside className="map-column"><MapPanel stations={ranked} selectedId={mapSelectedId} onSelect={(station) => { setMapSelectedId(station.id); setDetails(station); }} location={searchResult!.location} /><div className="map-disclaimer"><CircleAlert size={15} /> Availability is a snapshot, not a reservation.</div></aside>
        </div>
      </> : <div className="empty-state"><Search size={34} /><h2>No compatible stations found</h2><p>Try one of these ways to broaden your search.</p><div>{(searchResult?.suggestions ?? []).map((item) => <button key={item} onClick={() => { if (item.includes('radius')) setRadiusKm(20); if (item.includes('unknown')) setIncludeUnknown(true); }}>{item}</button>)}</div></div>}

      {compareIds.length > 0 && <div className="compare-tray"><div><span className="compare-stack">{compared.map((item, index) => <i key={item.id} style={{ zIndex: index }}>{item.name.charAt(0)}</i>)}</span><div><b>{compareIds.length} selected</b><small>Choose 2–4 stations</small></div></div><button className="text-button" onClick={() => setCompareIds([])}>Clear</button><button className="button primary" disabled={compareIds.length < 2} onClick={() => setShowComparison(true)}>Compare side by side</button></div>}
      {showComparison && <ComparisonModal stations={compared} connector={connector} energyKwh={energyKwh} location={searchResult!.location} onClose={() => setShowComparison(false)} onChoose={(station) => { setShowComparison(false); setDetails(station); notify(`${station.name} selected`); }} />}
      {details && <StationDetailsModal station={details} connector={connector} onClose={() => setDetails(null)} onMonitor={() => void monitor(details)} />}
      {predicting && <PredictionModal station={predicting} onClose={() => setPredicting(null)} />}
    </div>
  );
}
