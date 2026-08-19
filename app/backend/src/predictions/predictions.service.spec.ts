import type { Station } from '../common/types';
import { StationsService } from '../stations/stations.service';
import { PredictionsService } from './predictions.service';

const station: Station = {
  id: 'lta-test-station',
  name: 'Test Station',
  address: '1 Test Road',
  postalCode: '123456',
  latitude: 1.3048,
  longitude: 103.8318,
  operator: 'Test Operator',
  connectors: [{ type: 'CCS2', powerKw: 120, total: 4, available: 2, status: 'available' }],
  pricePerKwh: null,
  source: 'LTA DataMall',
  lastUpdated: '2026-08-19T12:00:00.000Z',
};

describe('PredictionsService', () => {
  it('does not fabricate a prediction without collected observations', () => {
    const stations = {
      findById: () => station,
      getAvailabilityObservations: () => [],
    } as unknown as StationsService;
    const result = new PredictionsService(stations).predict(station.id, new Date().toISOString());
    expect(result.status).toBe('insufficient_data');
    expect(result.sampleSize).toBe(0);
    expect(result).not.toHaveProperty('probability');
  });

  it('returns a probability based on collected live observations', () => {
    const arrival = new Date('2026-08-19T12:00:00.000Z');
    const observations = Array.from({ length: 6 }, (_, index) => ({
      stationId: station.id,
      timestamp: new Date(arrival.getTime() - (index + 1) * 7 * 86_400_000),
      available: index < 3,
    }));
    const stations = {
      findById: () => station,
      getAvailabilityObservations: () => observations,
    } as unknown as StationsService;
    const result = new PredictionsService(stations).predict(station.id, arrival.toISOString());
    expect(result.status).toBe('prediction_available');
    expect(result.sampleSize).toBe(6);
    expect(result.probability).toBe(50);
  });
});
