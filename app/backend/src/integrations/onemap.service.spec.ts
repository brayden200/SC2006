import { ConfigService } from '@nestjs/config';
import { OneMapService } from './onemap.service';

describe('OneMapService', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('geocodes with the documented token header and caches the result', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ SEARCHVAL: 'ORCHARD ROAD', LATITUDE: '1.3048', LONGITUDE: '103.8318' }] }),
    });
    global.fetch = fetchMock as typeof fetch;
    const service = new OneMapService(new ConfigService({ ONEMAP_TOKEN: 'test-token' }));

    await expect(service.searchAddress('Orchard Road')).resolves.toEqual({ latitude: 1.3048, longitude: 103.8318, label: 'ORCHARD ROAD' });
    await service.searchAddress('Orchard Road');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('test-token');
  });

  it('normalizes OneMap route summary seconds and metres', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 0, route_summary: { total_time: 615, total_distance: 4200 } }),
    }) as unknown as typeof fetch;
    const service = new OneMapService(new ConfigService({ ONEMAP_TOKEN: 'test-token' }));
    await expect(service.drivingRoute(
      { latitude: 1.3, longitude: 103.8 },
      { latitude: 1.32, longitude: 103.84 },
    )).resolves.toEqual({ travelMinutes: 10, distanceKm: 4.2, source: 'OneMap' });
  });
});
