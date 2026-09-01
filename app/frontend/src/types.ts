export type ConnectorType = 'CCS2' | 'Type 2' | 'CHAdeMO'
export type ConnectorPreference = 'Any' | ConnectorType
export type RankingPriority = 'Balanced' | 'Availability' | 'Speed' | 'Savings'
export type Page = 'explore'

export interface ParkingInfo {
  carParkId: string
  name: string
  provider: 'URA' | 'HDB'
  publishedRateText: string
  sourceName: string
  sourceUrl: string
  lastUpdated: string
  matchConfidence: 'high' | 'medium' | 'low'
  associationLabel: string
}

export interface Connector {
  type: ConnectorType
  powerKw: number
  total: number
  available: number | null
  status: 'available' | 'busy' | 'offline' | 'unknown'
}

export interface Station {
  id: string
  name: string
  address: string
  postalCode: string
  latitude: number
  longitude: number
  operator: string
  connectors: Connector[]
  pricePerKwh: number | null
  parking?: ParkingInfo | null
  source: string
  lastUpdated: string
  distanceKm?: number
  selectedConnector?: ConnectorType
}

export interface RankedStation extends Station {
  selectedConnector: ConnectorType
  score: number
  distanceKm: number
  travelMinutes: number | null
  travelSource: 'OneMap' | 'Straight-line estimate'
  estimatedCost: number | null
  estimatedChargeMinutes: number | null
  estimatedParkingCost: number | null
  estimatedTotalCost: number | null
  parkingEstimateStatus: 'calculated' | 'rate_only' | 'unavailable'
  reasons: string[]
}

export interface SearchMetadata {
  totalMatches: number
  location: { latitude: number; longitude: number; label: string }
  dataStatus: {
    source: string
    isCached: boolean
    lastUpdated: string
    fallbackReason: string | null
    ltaDataMall: IntegrationProviderStatus
    oneMap: IntegrationProviderStatus
  }
  operators: string[]
  suggestions: string[]
}

export interface SearchResponse extends SearchMetadata {
  stations: Array<Station & { distanceKm: number }>
}

export interface IntegrationProviderStatus {
  configured: boolean
  state: 'available' | 'error' | 'not_checked' | 'not_configured'
  lastError?: string | null
  lastSuccessfulFetch?: string | null
  lastSuccessfulRequest?: string | null
}

export interface RecommendationResponse {
  recommended: RankedStation | null
  ranked: RankedStation[]
  search: SearchMetadata
}

export type RouteCoordinate = [latitude: number, longitude: number]

export interface DrivingRoute {
  distanceKm: number
  travelMinutes: number
  coordinates: RouteCoordinate[]
  source: 'OneMap'
}
