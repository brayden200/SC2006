export type ConnectorType = 'CCS2' | 'Type 2' | 'CHAdeMO';
export type Page = 'explore' | 'monitoring' | 'history';

export interface Connector {
  type: ConnectorType;
  powerKw: number;
  total: number;
  available: number | null;
  status: 'available' | 'busy' | 'offline' | 'unknown';
}

export interface Station {
  id: string;
  name: string;
  address: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  operator: string;
  connectors: Connector[];
  pricePerKwh: number | null;
  source: string;
  lastUpdated: string;
  distanceKm?: number;
}

export interface RankedStation extends Station {
  score: number;
  distanceKm: number;
  travelMinutes: number | null;
  travelSource: 'OneMap' | 'Straight-line estimate';
  estimatedCost: number | null;
  estimatedChargeMinutes: number | null;
  scoreBreakdown: Record<string, number | null>;
  reasons: string[];
}

export interface SearchResponse {
  stations: Array<Station & { distanceKm: number }>;
  totalMatches: number;
  location: { latitude: number; longitude: number; label: string };
  dataStatus: {
    source: string;
    isCached: boolean;
    lastUpdated: string;
    fallbackReason: string | null;
    ltaDataMall: IntegrationProviderStatus;
    oneMap: IntegrationProviderStatus;
  };
  operators: string[];
  suggestions: string[];
}

export interface IntegrationProviderStatus {
  configured: boolean;
  state: 'available' | 'error' | 'not_checked' | 'not_configured';
  lastError?: string | null;
  lastSuccessfulFetch?: string | null;
  lastSuccessfulRequest?: string | null;
}

export interface RecommendationResponse {
  recommended: RankedStation | null;
  alternatives: RankedStation[];
  ranked: RankedStation[];
  disclaimer: string;
  dataStatus: SearchResponse['dataStatus'];
}

export interface MonitorEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export interface Monitor {
  id: string;
  stationId: string;
  connector: ConnectorType;
  createdAt: string;
  expiresAt: string;
  lastCheckedAt: string;
  lastKnownAvailability: number | null;
  status: 'active' | 'expired' | 'stopped';
  events: MonitorEvent[];
  station: Station;
}

export interface ChargingSession {
  id: string;
  stationId: string;
  stationName: string;
  startedAt: string;
  energyKwh: number;
  totalCost: number;
  durationMinutes: number;
  officialStatusAccurate?: boolean;
  note?: string;
  dataSource: string;
}
