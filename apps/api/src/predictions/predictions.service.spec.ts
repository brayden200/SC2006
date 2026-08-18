import { PredictionsService } from './predictions.service';
import { StationsService } from '../stations/stations.service';
import { ConfigService } from '@nestjs/config';
import { LtaDataMallService } from '../integrations/lta-datamall.service';
import { OneMapService } from '../integrations/onemap.service';

describe('PredictionsService', () => {
  it('returns a probability with its evidence sample', () => {
    const config = new ConfigService({});
    const service = new PredictionsService(new StationsService(new LtaDataMallService(config), new OneMapService(config)));
    const result = service.predict('cw-orchard-central', new Date().toISOString());
    expect(result.status).toBe('prediction_available');
    expect(result.sampleSize).toBeGreaterThanOrEqual(5);
    expect(result).toHaveProperty('probability');
  });
});
