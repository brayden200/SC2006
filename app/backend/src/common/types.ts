export type ConnectorType = 'CCS2' | 'Type 2' | 'CHAdeMO';
export type AvailabilityStatus = 'available' | 'busy' | 'offline' | 'unknown';

export interface Connector {
  type: ConnectorType;
  powerKw: number;
  total: number;
  available: number | null;
  status: AvailabilityStatus;
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
  source: 'LTA DataMall' | 'Cached demo data';
  lastUpdated: string;
}

export interface LocationInput {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface ScoreBreakdown {
  availability: number;
  travelTime: number;
  chargingSpeed: number;
  price: number | null;
  preference: number;
}

export interface RankedStation extends Station {
  score: number;
  distanceKm: number;
  travelMinutes: number | null;
  travelSource: 'OneMap' | 'Straight-line estimate';
  estimatedCost: number | null;
  estimatedChargeMinutes: number | null;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
}
