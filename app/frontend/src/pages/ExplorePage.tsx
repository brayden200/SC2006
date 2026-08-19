import { useState } from 'react';
import { ActionIcon, Alert, Button, Checkbox, Loader, Paper, Select, Slider, TextInput } from '@mantine/core';
import { AlertTriangle, CircleAlert, LocateFixed, Search, SlidersHorizontal, X } from 'lucide-react';
import { api } from '../api';
import { ComparisonModal } from '../components/ComparisonModal';
import { MapPanel } from '../components/MapPanel';
import { PredictionModal } from '../components/PredictionModal';
import { StationCard } from '../components/StationCard';
import { StationDetailsModal } from '../components/StationDetailsModal';
import type {
  ConnectorPreference,
  ConnectorType,
  Page,
  RankedStation,
  RecommendationResponse,
  SearchResponse,
  Station,
} from '../types';

const weightSets = {
  Balanced: {
    availabilityWeight: 30,
    travelWeight: 25,
    speedWeight: 20,
    priceWeight: 15,
    preferenceWeight: 10,
  },
  Availability: {
    availabilityWeight: 50,
    travelWeight: 20,
    speedWeight: 15,
    priceWeight: 10,
    preferenceWeight: 5,
  },
  Speed: { availabilityWeight: 25, travelWeight: 20, speedWeight: 40, priceWeight: 10, preferenceWeight: 5 },
  Savings: {
    availabilityWeight: 25,
    travelWeight: 20,
    speedWeight: 10,
    priceWeight: 40,
    preferenceWeight: 5,
  },
};

export function ExplorePage({
  navigate,
  notify,
}: {
  navigate: (page: Page) => void;
  notify: (message: string) => void;
}) {
  const [locationQuery, setLocationQuery] = useState('');
  const [connector, setConnector] = useState<ConnectorPreference>('Any');
  const [appliedConnector, setAppliedConnector] = useState<ConnectorPreference>('Any');
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
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [details, setDetails] = useState<RankedStation | null>(null);
  const [predicting, setPredicting] = useState<Station | null>(null);
  const [mapSelectedId, setMapSelectedId] = useState<string>();
  const [searchCoords, setSearchCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  const runSearch = async () => {
    if (!locationQuery.trim() && !searchCoords) {
      setError('Enter an address or postal code, or use your current location.');
      return;
    }
    const requestedConnector = connector;
    setLoading(true);
    setError('');
    setCompareIds([]);
    try {
      const search = await api.searchStations({
        query: locationQuery,
        latitude: searchCoords?.latitude,
        longitude: searchCoords?.longitude,
        radiusKm,
        connector: requestedConnector === 'Any' ? undefined : requestedConnector,
        availableOnly,
        includeUnknown,
        minPowerKw: minPowerKw || undefined,
        maxPrice: maxPrice || undefined,
        operator: operator || undefined,
      });
      setSearchResult(search);
      const ranked = await api.recommend({
        latitude: search.location.latitude,
        longitude: search.location.longitude,
        locationLabel: search.location.label,
        radiusKm,
        connector: requestedConnector,
        energyKwh,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        minPowerKw: minPowerKw || undefined,
        availableOnly,
        includeUnknown,
        operator: operator || undefined,
        preferredOperator: operator || undefined,
        ...weightSets[priority],
      });
      const allowed = new Set(search.stations.map((item) => item.id));
      ranked.ranked = ranked.ranked.filter((item) => allowed.has(item.id));
      ranked.recommended = ranked.ranked[0] ?? null;
      ranked.alternatives = ranked.ranked.slice(1, 3);
      setHasSearched(true);
      setAppliedConnector(requestedConnector);
      setRecommendation(ranked);
      if (ranked.recommended) setMapSelectedId(ranked.recommended.id);
      notify(`${ranked.ranked.length} compatible station${ranked.ranked.length === 1 ? '' : 's'} found`);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('Location is unavailable. Enter an address or postal code instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setCurrentLocation(nextLocation);
        setSearchCoords({ latitude: nextLocation.latitude, longitude: nextLocation.longitude });
        setLocationQuery('My current location');
        notify(
          `Current location found (about ${Math.round(nextLocation.accuracy)} m accuracy) — press Search to refresh`,
        );
      },
      () => setError('Location permission was denied. Enter an address or Singapore postal code instead.'),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
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
    const selectedConnector =
      station.selectedConnector ??
      (appliedConnector === 'Any' ? station.connectors[0]?.type : appliedConnector);
    if (!selectedConnector) {
      notify('No compatible connector is available at this station');
      return;
    }
    try {
      await api.createMonitor(station.id, selectedConnector);
      notify(`Monitoring ${station.name} (${selectedConnector}) for 90 minutes`);
      setDetails(null);
      navigate('monitoring');
    } catch (reason) {
      notify((reason as Error).message);
    }
  };

  return (
    <div className="page explore-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">INTELLIGENT CHARGER SEARCH</span>
          <h1>
            Find your best charge, <em>not just the nearest.</em>
          </h1>
          <p>Live availability, travel time, speed and price—ranked around what matters to you.</p>
        </div>
      </section>

      <Paper className="search-card" radius="lg" shadow="sm" withBorder>
        <div className="search-grid">
          <TextInput
            className="location-field"
            label="Where do you need to charge?"
            value={locationQuery}
            onChange={(event) => {
              setLocationQuery(event.currentTarget.value);
              setSearchCoords(null);
              setError('');
            }}
            placeholder="Address or postal code"
            leftSection={<Search size={18} />}
            rightSection={
              <ActionIcon variant="subtle" onClick={useMyLocation} aria-label="Use current location">
                <LocateFixed size={18} />
              </ActionIcon>
            }
          />
          <Select
            label="Connector"
            value={connector}
            onChange={(value) => setConnector((value ?? 'Any') as ConnectorPreference)}
            data={[
              { value: 'Any', label: 'Any connector' },
              { value: 'CCS2', label: 'CCS2' },
              { value: 'Type 2', label: 'Type 2' },
              { value: 'CHAdeMO', label: 'CHAdeMO' },
            ]}
            allowDeselect={false}
          />
          <Select
            label="Ranking priority"
            value={priority}
            onChange={(value) => setPriority((value ?? 'Balanced') as keyof typeof weightSets)}
            data={Object.keys(weightSets)}
            allowDeselect={false}
          />
          <Button
            className="search-button"
            onClick={() => void runSearch()}
            loading={loading}
            leftSection={<Search size={17} />}
          >
            Search
          </Button>
        </div>
        <div className="quick-filters">
          <Button
            size="compact-sm"
            variant={availableOnly ? 'light' : 'default'}
            onClick={() => setAvailableOnly((value) => !value)}
          >
            Available now
          </Button>
          <Button
            size="compact-sm"
            variant={minPowerKw === 100 ? 'light' : 'default'}
            onClick={() => setMinPowerKw((value) => (value === 100 ? 0 : 100))}
          >
            100+ kW fast
          </Button>
          <Button
            size="compact-sm"
            variant="default"
            leftSection={<SlidersHorizontal size={14} />}
            rightSection={filtersOpen ? <X size={13} /> : undefined}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            All filters
          </Button>
        </div>
        {filtersOpen && (
          <div className="advanced-filters">
            <div className="filter-slider">
              <span>Search radius</span>
              <b>{radiusKm} km</b>
              <Slider min={2} max={25} value={radiusKm} onChange={setRadiusKm} />
            </div>
            <div className="filter-slider">
              <span>Energy to add</span>
              <b>{energyKwh} kWh</b>
              <Slider min={10} max={80} step={5} value={energyKwh} onChange={setEnergyKwh} />
            </div>
            <Select
              label="Maximum price"
              value={maxPrice}
              onChange={(value) => setMaxPrice(value ?? '')}
              data={[
                { value: '', label: 'Any / unknown allowed' },
                { value: '0.50', label: 'Up to $0.50/kWh' },
                { value: '0.60', label: 'Up to $0.60/kWh' },
                { value: '0.70', label: 'Up to $0.70/kWh' },
              ]}
              allowDeselect={false}
            />
            <Select
              label="Operator"
              value={operator}
              onChange={(value) => setOperator(value ?? '')}
              data={[
                { value: '', label: 'Any operator' },
                ...(searchResult?.operators ?? []).map((item) => ({ value: item, label: item })),
              ]}
              searchable
              allowDeselect={false}
            />
            <Checkbox
              label="Include unknown availability"
              checked={includeUnknown}
              onChange={(event) => setIncludeUnknown(event.currentTarget.checked)}
            />
          </div>
        )}
      </Paper>

      {error && (
        <Alert className="error-banner" color="red" icon={<CircleAlert size={18} />}>
          {error}
        </Alert>
      )}
      {searchResult?.dataStatus.isCached ? (
        <Alert className="cache-banner" color="yellow" icon={<AlertTriangle size={16} />}>
          <span>
            <b>Using the latest cached LTA snapshot</b> · Updated{' '}
            {new Date(searchResult.dataStatus.lastUpdated).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            . {searchResult.dataStatus.fallbackReason || 'Live availability is never guaranteed.'}
          </span>
        </Alert>
      ) : (
        searchResult && (
          <Alert className="cache-banner" color="green">
            <span>
              <b>Live LTA DataMall charging data</b> · Travel times use{' '}
              {searchResult.dataStatus.oneMap.state === 'available'
                ? 'OneMap'
                : 'straight-line distance estimates'}
              .
            </span>
          </Alert>
        )
      )}

      {loading ? (
        <div className="page-loading">
          <Loader size="md" />
          <h3>Ranking compatible chargers…</h3>
          <p>Balancing availability, travel, speed and price.</p>
        </div>
      ) : ranked.length > 0 ? (
        <>
          <div className="results-heading">
            <div>
              <h2>
                {searchResult && searchResult.totalMatches > ranked.length
                  ? `Top ${ranked.length} of ${searchResult.totalMatches}`
                  : ranked.length}{' '}
                compatible options
              </h2>
              <p>
                Near {searchResult?.location.label} · ranked for {priority.toLowerCase()}
              </p>
            </div>
            <span className="result-updated">
              <i /> Data checked just now
            </span>
          </div>
          <div className="results-layout">
            <div className="station-list">
              {ranked.map((station, index) => (
                <StationCard
                  key={station.id}
                  station={station}
                  connector={appliedConnector}
                  rank={index + 1}
                  best={index === 0}
                  compared={compareIds.includes(station.id)}
                  onCompare={() => toggleCompare(station.id)}
                  onDetails={() => setDetails(station)}
                  onMonitor={() => void monitor(station)}
                  onPredict={() => setPredicting(station)}
                  onHover={() => setMapSelectedId(station.id)}
                />
              ))}
            </div>
            <aside className="map-column">
              <MapPanel
                stations={ranked}
                connector={appliedConnector}
                selectedId={mapSelectedId}
                onSelect={(station) => {
                  setMapSelectedId(station.id);
                  setDetails(station);
                }}
                location={searchResult!.location}
                currentLocation={currentLocation ?? undefined}
              />
              <div className="map-disclaimer">
                <CircleAlert size={15} /> Availability is a snapshot, not a reservation.
              </div>
            </aside>
          </div>
        </>
      ) : hasSearched ? (
        <div className="empty-state">
          <Search size={34} />
          <h2>No compatible stations found</h2>
          <p>Try one of these ways to broaden your search.</p>
          <div>
            {(searchResult?.suggestions ?? []).map((item) => (
              <Button
                variant="default"
                size="compact-sm"
                key={item}
                onClick={() => {
                  if (item.includes('radius')) setRadiusKm(20);
                  if (item.includes('unknown')) setIncludeUnknown(true);
                }}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <LocateFixed size={34} />
          <h2>Choose where you want to charge</h2>
          <p>Enter a Singapore address or postal code, or use your current location to begin.</p>
        </div>
      )}

      {compareIds.length > 0 && (
        <div className="compare-tray">
          <div>
            <span className="compare-stack">
              {compared.map((item, index) => (
                <i key={item.id} style={{ zIndex: index }}>
                  {item.name.charAt(0)}
                </i>
              ))}
            </span>
            <div>
              <b>{compareIds.length} selected</b>
              <small>Choose 2–4 stations</small>
            </div>
          </div>
          <Button variant="subtle" size="compact-sm" onClick={() => setCompareIds([])}>
            Clear
          </Button>
          <Button disabled={compareIds.length < 2} onClick={() => setShowComparison(true)}>
            Compare side by side
          </Button>
        </div>
      )}
      {showComparison && (
        <ComparisonModal
          stations={compared}
          connector={appliedConnector}
          energyKwh={energyKwh}
          location={searchResult!.location}
          onClose={() => setShowComparison(false)}
          onChoose={(station) => {
            setShowComparison(false);
            setDetails(station);
            notify(`${station.name} selected`);
          }}
        />
      )}
      {details && (
        <StationDetailsModal
          station={details}
          connector={details.selectedConnector}
          onClose={() => setDetails(null)}
          onMonitor={() => void monitor(details)}
        />
      )}
      {predicting && <PredictionModal station={predicting} onClose={() => setPredicting(null)} />}
    </div>
  );
}
