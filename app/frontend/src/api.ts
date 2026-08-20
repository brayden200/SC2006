import type {
  ConnectorPreference,
  ConnectorType,
  DrivingRoute,
  IntegrationProviderStatus,
  Monitor,
  RankedStation,
  RecommendationResponse,
  SearchResponse,
  Station,
} from './types'

const API_URL = import.meta.env.VITE_API_URL ?? '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { message?: string | string[] } | null
    const message = Array.isArray(error?.message) ? error.message.join(', ') : error?.message
    throw new Error(message || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export const api = {
  getIntegrationStatus() {
    return request<{
      ltaDataMall: IntegrationProviderStatus
      oneMap: IntegrationProviderStatus
      parking: { ura: IntegrationProviderStatus; hdb: IntegrationProviderStatus }
    }>('/integrations/status')
  },
  searchStations(params: Record<string, string | number | boolean | undefined>) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => value !== undefined && query.set(key, String(value)))
    return request<SearchResponse>(`/stations?${query}`)
  },
  getStation(id: string) {
    return request<Station>(`/stations/${id}`)
  },
  getDrivingRoute(
    origin: Pick<StationLocation, 'latitude' | 'longitude'>,
    destination: Pick<StationLocation, 'latitude' | 'longitude'>,
  ) {
    const query = new URLSearchParams({
      startLat: String(origin.latitude),
      startLng: String(origin.longitude),
      endLat: String(destination.latitude),
      endLng: String(destination.longitude),
    })
    return request<DrivingRoute>(`/routes/driving?${query}`)
  },
  searchStationOptions(query: string) {
    return request<{ stations: StationOption[] }>(`/stations/options?query=${encodeURIComponent(query)}`)
  },
  recommend(body: Record<string, unknown>) {
    return request<RecommendationResponse>('/recommendations', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  },
  compare(body: {
    stationIds: string[]
    connector: ConnectorPreference
    energyKwh: number
    latitude: number
    longitude: number
  }) {
    return request<CompareResponse>('/compare', { method: 'POST', body: JSON.stringify(body) })
  },
  getMonitors() {
    return request<{ monitors: Monitor[] }>('/monitoring')
  },
  createMonitor(stationId: string, connector: ConnectorType) {
    return request<Monitor>('/monitoring', {
      method: 'POST',
      body: JSON.stringify({ stationId, connector, durationMinutes: 90 }),
    })
  },
  checkMonitor(id: string) {
    return request<Monitor>(`/monitoring/${id}/check`, { method: 'POST' })
  },
  stopMonitor(id: string) {
    return request<Monitor>(`/monitoring/${id}`, { method: 'DELETE' })
  },
  getAlternatives(id: string, latitude: number, longitude: number) {
    return request<AlternativesResponse>(
      `/monitoring/${id}/alternatives?latitude=${latitude}&longitude=${longitude}&radiusKm=15`,
    )
  },
  acceptAlternative(id: string, stationId: string) {
    return request<Monitor>(`/monitoring/${id}/accept-alternative`, {
      method: 'POST',
      body: JSON.stringify({ stationId }),
    })
  },
}

export interface CompareOption {
  id: string
  name: string
  operator: string
  connector: ConnectorType | null
  connectorCompatible: boolean
  availability: number | null
  availabilityStatus: string
  powerKw: number | null
  estimatedChargeMinutes: number | null
  pricePerKwh: number | null
  estimatedCost: number | null
  parking: import('./types').ParkingInfo | null
  parkingRateText: string | null
  estimatedParkingCost: number | null
  estimatedTotalCost: number | null
  parkingEstimateStatus: 'calculated' | 'rate_only' | 'unavailable'
  distanceKm: number
  travelMinutes: number
  lastUpdated: string
  travelSource: 'OneMap' | 'Straight-line estimate'
}
export interface StationOption {
  id: string
  name: string
  address: string
}
interface StationLocation {
  latitude: number
  longitude: number
}
export interface CompareResponse {
  connector: ConnectorPreference
  energyKwh: number
  options: CompareOption[]
  highlights: Record<string, { best: string[]; weakest: string[] }>
}
export interface AlternativesResponse {
  currentStation: Station
  recommended: RankedStationWithDetour | null
  alternatives: RankedStationWithDetour[]
  message: string
}
interface RankedStationWithDetour extends RankedStation {
  additionalTravelMinutes: number
}
