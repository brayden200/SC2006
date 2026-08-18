import { RecommendationsService } from './recommendations.service';
import { StationsService } from '../stations/stations.service';
import { ConfigService } from '@nestjs/config';
import { LtaDataMallService } from '../integrations/lta-datamall.service';
import { OneMapService } from '../integrations/onemap.service';

describe('RecommendationsService', () => {
  const config = new ConfigService({});
  const oneMap = new OneMapService(config);
  const stations = new StationsService(new LtaDataMallService(config), oneMap);
  const service = new RecommendationsService(stations, oneMap);

  it('never ranks an incompatible connector', async () => {
    const result = await service.recommend({
      latitude: 1.3048,
      longitude: 103.8318,
      connector: 'CHAdeMO',
      radiusKm: 30,
    });
    expect(result.ranked.length).toBeGreaterThan(0);
    result.ranked.forEach((station) => {
      expect(station.connectors.some((connector) => connector.type === 'CHAdeMO')).toBe(true);
    });
  });

  it('redistributes the missing price weight instead of inventing a price', () => {
    const station = stations.findById('cw-vivo-city');
    const ranked = service.rankStation({ ...station, distanceKm: 1 }, {
      latitude: 1.2644,
      longitude: 103.8223,
      connector: 'CCS2',
    });
    expect(ranked.estimatedCost).toBeNull();
    expect(ranked.scoreBreakdown.price).toBeNull();
    expect(ranked.reasons).toContain('Price is unknown and was excluded from scoring');
  });
});
