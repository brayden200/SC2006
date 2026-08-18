import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvailabilityStatus, Connector, ConnectorType, Station } from '../common/types';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class LtaDataMallService {
  private readonly baseUrl: string;
  private cache: { stations: Station[]; fetchedAt: string; expiresAt: number } | null = null;
  private lastError: string | null = null;
  private failureRetryAt = 0;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get('LTA_DATAMALL_BASE_URL') ?? 'https://datamall2.mytransport.sg/ltaodataservice';
  }

  isConfigured() {
    return Boolean(this.config.get<string>('LTA_ACCOUNT_KEY'));
  }

  status() {
    return {
      configured: this.isConfigured(),
      state: this.lastError ? 'error' : this.cache ? 'available' : this.isConfigured() ? 'not_checked' : 'not_configured',
      lastSuccessfulFetch: this.cache?.fetchedAt ?? null,
      lastError: this.lastError,
      cacheExpiresAt: this.cache ? new Date(this.cache.expiresAt).toISOString() : null,
      nextRetryAt: this.failureRetryAt > Date.now() ? new Date(this.failureRetryAt).toISOString() : null,
    };
  }

  async getAllStations(force = false): Promise<Station[]> {
    const accountKey = this.config.get<string>('LTA_ACCOUNT_KEY');
    if (!accountKey) throw new Error('LTA_ACCOUNT_KEY is not configured');
    if (!force && this.cache && this.cache.expiresAt > Date.now()) return structuredClone(this.cache.stations);
    if (!force && !this.cache && this.lastError && this.failureRetryAt > Date.now()) throw new Error(this.lastError);

    try {
      const batch = await this.fetchJson(`${this.baseUrl}/EVCBatch`, {
        AccountKey: accountKey,
        Accept: 'application/json',
      });
      const link = this.findBatchLink(batch);
      if (!link) throw new Error('LTA EVCBatch did not return a download link');
      const payload = await this.fetchJson(link);
      const fetchedAt = new Date().toISOString();
      const sourceUpdatedAt = this.sourceTimestamp(payload) ?? fetchedAt;
      const stations = this.normalizePayload(payload, sourceUpdatedAt);
      if (!stations.length) throw new Error('LTA EVCBatch contained no supported charging stations');
      this.cache = { stations, fetchedAt, expiresAt: Date.now() + 4 * 60_000 };
      this.lastError = null;
      this.failureRetryAt = 0;
      return structuredClone(stations);
    } catch (error) {
      this.lastError = this.safeError(error);
      this.failureRetryAt = Date.now() + 60_000;
      if (this.cache) return structuredClone(this.cache.stations);
      throw error;
    }
  }

  async getStationsByPostalCode(postalCode: string): Promise<Station[]> {
    const accountKey = this.config.get<string>('LTA_ACCOUNT_KEY');
    if (!accountKey) throw new Error('LTA_ACCOUNT_KEY is not configured');
    const url = new URL(`${this.baseUrl}/EVChargingPoints`);
    url.searchParams.set('PostalCode', postalCode);
    const payload = await this.fetchJson(url.toString(), { AccountKey: accountKey, Accept: 'application/json' });
    return this.normalizePayload(payload, new Date().toISOString());
  }

  normalizePayload(payload: unknown, fetchedAt = new Date().toISOString()): Station[] {
    const records = this.extractRecords(payload);
    return records.map((record, index) => this.normalizeStation(record, fetchedAt, index)).filter((station): station is Station => Boolean(station));
  }

  private normalizeStation(record: JsonRecord, fetchedAt: string, index: number): Station | null {
    const latitude = this.number(record.latitude ?? record.Latitude);
    const longitude = this.number(record.longtitude ?? record.longitude ?? record.Longitude);
    if (latitude === null || longitude === null) return null;

    const chargingPoints = this.arrayOfRecords(record.chargingPoints ?? record.ChargingPoints);
    const connectorGroups = new Map<ConnectorType, { powers: number[]; statuses: unknown[]; prices: number[]; total: number; available: number }>();
    let operator = '';

    for (const point of chargingPoints) {
      operator ||= this.string(point.operator ?? point.Operator);
      const pointStatus = point.status ?? point.Status;
      const plugTypes = this.arrayOfRecords(point.plugTypes ?? point.PlugTypes);
      for (const plug of plugTypes) {
        const connectorType = this.connectorType(this.string(plug.plugType ?? plug.PlugType));
        if (!connectorType) continue;
        const group = connectorGroups.get(connectorType) ?? { powers: [], statuses: [], prices: [], total: 0, available: 0 };
        const power = this.number(plug.chargingSpeed ?? plug.ChargingSpeed ?? plug.powerRating ?? plug.PowerRating);
        if (power !== null) group.powers.push(power);
        const priceType = this.string(plug.priceType ?? plug.PriceType).toLowerCase().replace('$', '');
        const price = this.number(plug.price ?? plug.Price);
        if (price !== null && price > 0 && (priceType.includes('kwh') || priceType === '')) group.prices.push(price);
        const evIds = this.arrayOfRecords(plug.evIds ?? plug.EvIds ?? plug.EVIds);
        const statuses = evIds.length ? evIds.map((item) => item.status ?? item.Status) : [pointStatus];
        group.statuses.push(...statuses);
        group.total += Math.max(1, statuses.length);
        group.available += statuses.filter((status) => this.statusCode(status) === 1).length;
        connectorGroups.set(connectorType, group);
      }
    }

    const connectors: Connector[] = [...connectorGroups.entries()].map(([type, group]) => ({
      type,
      powerKw: group.powers.length ? Math.max(...group.powers) : 0,
      total: group.total,
      available: group.statuses.every((status) => status === undefined || status === null || status === '') ? null : group.available,
      status: this.availabilityStatus(group.statuses, group.available),
    }));
    if (!connectors.length) return null;

    const allPrices = [...connectorGroups.values()].flatMap((group) => group.prices);
    const locationId = this.string(record.locationId ?? record.LocationId) || `${longitude.toFixed(6)}-${latitude.toFixed(6)}`;
    const address = this.string(record.address ?? record.Address);
    const name = this.string(record.name ?? record.Name) || chargingPoints.map((point) => this.string(point.name ?? point.Name)).find(Boolean) || address || `EV charging station ${index + 1}`;
    const postalCode = this.postalCode(address, this.string(record.postalCode ?? record.PostalCode));
    return {
      id: `lta-${locationId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
      name,
      address: address || name,
      postalCode,
      latitude,
      longitude,
      operator: operator || 'Unknown',
      connectors,
      pricePerKwh: allPrices.length ? Math.min(...allPrices) : null,
      source: 'LTA DataMall',
      lastUpdated: fetchedAt,
    };
  }

  private findBatchLink(payload: unknown): string | null {
    const record = this.extractRecords(payload)[0] ?? (this.record(payload) ? payload as JsonRecord : {});
    return this.nullableString(record.Link ?? record.link);
  }

  private extractRecords(payload: unknown): JsonRecord[] {
    if (Array.isArray(payload)) return payload.filter(this.record);
    if (!this.record(payload)) return [];
    for (const key of ['value', 'Value', 'data', 'Data', 'chargingStations', 'ChargingStations', 'evLocationsData']) {
      if (Array.isArray(payload[key])) return (payload[key] as unknown[]).filter(this.record);
    }
    return ('latitude' in payload || 'Latitude' in payload) ? [payload] : [];
  }

  private connectorType(value: string): ConnectorType | null {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.includes('chademo')) return 'CHAdeMO';
    if (normalized.includes('ccs2') || normalized === 'combo2' || normalized.includes('combotype2') || normalized.includes('ccscombo2')) return 'CCS2';
    if (normalized.includes('type2') || normalized.includes('iec62196')) return 'Type 2';
    return null;
  }

  private availabilityStatus(statuses: unknown[], available: number): AvailabilityStatus {
    if (available > 0) return 'available';
    if (statuses.some((status) => this.statusCode(status) === 0)) return 'busy';
    if (statuses.length && statuses.every((status) => status === '' || status === null || status === undefined || this.statusCode(status) === 100)) return 'offline';
    return 'unknown';
  }

  private async fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`LTA DataMall request failed with HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  }

  private record(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  private arrayOfRecords(value: unknown) { return Array.isArray(value) ? value.filter(this.record) : []; }
  private string(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''; }
  private nullableString(value: unknown) { const result = this.string(value); return result && result !== '-' ? result : null; }
  private number(value: unknown) { if (value === '' || value === null || value === undefined) return null; const result = Number(value); return Number.isFinite(result) ? result : null; }
  private statusCode(value: unknown) { return value === '' || value === null || value === undefined ? null : this.number(value); }
  private postalCode(address: string, explicit: string) { return explicit || address.match(/\b\d{6}\b/)?.[0] || ''; }
  private sourceTimestamp(payload: unknown) {
    if (!this.record(payload)) return null;
    const raw = this.string(payload.LastUpdatedTime ?? payload.lastUpdatedTime);
    if (!raw) return null;
    const parsed = new Date(raw.replace(' ', 'T') + (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? '' : '+08:00'));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  private safeError(error: unknown) { return error instanceof Error ? error.message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]') : 'Unknown LTA DataMall error'; }
}
