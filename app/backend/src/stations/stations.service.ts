import { Injectable, NotFoundException } from '@nestjs/common';
import { ConnectorType, LocationInput, Station } from '../common/types';
import { KNOWN_LOCATIONS, STATIONS } from './station-data';
import { SearchStationsDto } from './dto/search-stations.dto';
import { LtaDataMallService } from '../integrations/lta-datamall.service';
import { OneMapService } from '../integrations/onemap.service';

export interface StationSearchResult {
  stations: Array<Station & { distanceKm: number }>;
  totalMatches: number;
  location: LocationInput;
  dataStatus: {
    source: string;
    isCached: boolean;
    lastUpdated: string;
    ltaDataMall: ReturnType<LtaDataMallService['status']>;
    oneMap: ReturnType<OneMapService['status']>;
    fallbackReason: string | null;
  };
  operators: string[];
  suggestions: string[];
}

@Injectable()
export class StationsService {
  private stations: Station[] = structuredClone(STATIONS);
  private fallbackReason: string | null = null;

  constructor(
    private readonly lta: LtaDataMallService,
    private readonly oneMap: OneMapService,
  ) {}

  getAll(): Station[] {
    return structuredClone(this.stations);
  }

  findById(id: string): Station {
    const station = this.stations.find((item) => item.id === id);
    if (!station) throw new NotFoundException(`Station ${id} was not found`);
    return structuredClone(station);
  }

  async resolveLocation(query?: string, latitude?: number, longitude?: number): Promise<LocationInput> {
    if (latitude !== undefined && longitude !== undefined) {
      return { latitude, longitude, label: query || 'Selected location' };
    }

    if (query?.trim() && this.oneMap.isConfigured()) {
      try {
        const result = await this.oneMap.searchAddress(query);
        if (result) return result;
      } catch {
        // Continue with the local geocoding fallback so search remains available.
      }
    }

    const normalised = query?.trim().toLowerCase() ?? 'orchard';
    const exact = KNOWN_LOCATIONS[normalised];
    if (exact) return exact;

    const key = Object.keys(KNOWN_LOCATIONS).find((candidate) => normalised.includes(candidate));
    if (key) return KNOWN_LOCATIONS[key];

    const station = this.stations.find((item) =>
      `${item.name} ${item.address} ${item.postalCode}`.toLowerCase().includes(normalised),
    );
    if (station) {
      return { latitude: station.latitude, longitude: station.longitude, label: query };
    }

    return KNOWN_LOCATIONS.singapore;
  }

  async search(dto: SearchStationsDto): Promise<StationSearchResult> {
    await this.refreshFromProvider();
    const location = await this.resolveLocation(dto.query, dto.latitude, dto.longitude);
    const radius = dto.radiusKm ?? 8;
    let stations = this.stations
      .map((station) => ({ ...structuredClone(station), distanceKm: this.distanceKm(location, station) }))
      .filter((station) => station.distanceKm <= radius);

    if (dto.connector) {
      stations = stations.filter((station) =>
        station.connectors.some((connector) => connector.type === dto.connector),
      );
    }
    if (dto.minPowerKw !== undefined) {
      stations = stations.filter((station) =>
        station.connectors.some(
          (connector) =>
            (!dto.connector || connector.type === dto.connector) && connector.powerKw >= dto.minPowerKw!,
        ),
      );
    }
    if (dto.availableOnly) {
      stations = stations.filter((station) =>
        station.connectors.some(
          (connector) =>
            (!dto.connector || connector.type === dto.connector) &&
            (connector.available ?? 0) > 0 &&
            connector.status === 'available',
        ),
      );
    }
    if (!dto.includeUnknown) {
      stations = stations.filter((station) =>
        station.connectors.some(
          (connector) =>
            (!dto.connector || connector.type === dto.connector) && connector.status !== 'unknown',
        ),
      );
    }
    if (dto.maxPrice !== undefined) {
      stations = stations.filter(
        (station) =>
          station.pricePerKwh !== null && station.pricePerKwh > 0 && station.pricePerKwh <= dto.maxPrice!,
      );
    }
    const operators = [...new Set(stations.map((station) => station.operator).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    );
    if (dto.operator) {
      const requestedOperator = this.operatorKey(dto.operator);
      stations = stations.filter((station) => this.operatorKey(station.operator) === requestedOperator);
    }

    stations.sort((a, b) => a.distanceKm - b.distanceKm);
    const totalMatches = stations.length;
    stations = stations.slice(0, dto.limit ?? 50);
    const lastUpdated = (stations.length ? stations : this.stations).reduce(
      (latest, station) => (station.lastUpdated > latest ? station.lastUpdated : latest),
      new Date(0).toISOString(),
    );
    return {
      stations,
      totalMatches,
      location,
      dataStatus: {
        source: this.stations[0]?.source ?? 'Cached demo data',
        isCached:
          this.stations[0]?.source !== 'LTA DataMall' ||
          this.lta.status().state === 'error' ||
          Boolean(this.fallbackReason),
        lastUpdated,
        ltaDataMall: this.lta.status(),
        oneMap: this.oneMap.status(),
        fallbackReason: this.fallbackReason,
      },
      operators,
      suggestions: stations.length
        ? []
        : ['Increase the search radius', 'Try another connector', 'Allow stations with unknown status'],
    };
  }

  async refreshFromProvider(force = false) {
    if (!this.lta.isConfigured()) {
      this.fallbackReason = 'LTA_ACCOUNT_KEY is not configured; using bundled cached data.';
      return false;
    }
    try {
      const live = await this.lta.getAllStations(force);
      if (live.length) this.stations = live;
      this.fallbackReason =
        this.lta.status().state === 'error'
          ? `${this.lta.status().lastError ?? 'LTA DataMall is unavailable'}; using the most recent LTA cache.`
          : null;
      return true;
    } catch (error) {
      this.fallbackReason =
        error instanceof Error
          ? `${error.message}; using the most recent cache.`
          : 'LTA DataMall unavailable; using the most recent cache.';
      return false;
    }
  }

  setConnectorAvailability(stationId: string, connectorType: ConnectorType, available: number | null) {
    const station = this.stations.find((item) => item.id === stationId);
    if (!station) throw new NotFoundException(`Station ${stationId} was not found`);
    const connector = station.connectors.find((item) => item.type === connectorType);
    if (!connector) throw new NotFoundException(`Connector ${connectorType} was not found`);
    connector.available = available;
    connector.status = available === null ? 'unknown' : available > 0 ? 'available' : 'busy';
    station.lastUpdated = new Date().toISOString();
    return structuredClone(station);
  }

  distanceKm(a: Pick<LocationInput, 'latitude' | 'longitude'>, b: Pick<Station, 'latitude' | 'longitude'>) {
    const earthRadiusKm = 6371;
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return Number((earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))).toFixed(2));
  }

  private operatorKey(value: string) {
    return value
      .toLowerCase()
      .replace(/\b(private|pte|limited|ltd)\b\.?/g, '')
      .replace(/[^a-z0-9+]/g, '');
  }
}
