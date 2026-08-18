import { ConfigService } from '@nestjs/config';
import { LtaDataMallService } from './lta-datamall.service';

describe('LtaDataMallService', () => {
  it('normalizes the documented nested EV charging-point structure', () => {
    const service = new LtaDataMallService(new ConfigService({}));
    const stations = service.normalizePayload({ value: [{
      address: '1 Test Road Singapore 123456', name: 'Test Hub', longtitude: 103.84,
      latitude: 1.3, locationId: '103840123456', chargingPoints: [{ status: 1,
        operator: 'Test EVCO', plugTypes: [{ plugType: 'CCS2',
          chargingSpeed: 120, price: 0.58, priceType: '$/kWh', evIds: [
            { evCpId: 'A-001', status: 1 }, { evCpId: 'A-002', status: 0 },
          ],
        }],
      }],
    }] }, '2026-08-18T00:00:00.000Z');

    expect(stations).toHaveLength(1);
    expect(stations[0]).toMatchObject({
      name: 'Test Hub', postalCode: '123456', source: 'LTA DataMall',
      operator: 'Test EVCO', pricePerKwh: 0.58,
    });
    expect(stations[0].connectors[0]).toMatchObject({ type: 'CCS2', powerKw: 120, total: 2, available: 1, status: 'available' });
  });

  it('keeps unavailable LTA statuses distinct from occupied statuses', () => {
    const service = new LtaDataMallService(new ConfigService({}));
    const station = service.normalizePayload([{ latitude: 1.3, longtitude: 103.8, name: 'Offline',
      chargingPoints: [{ plugTypes: [{ plugType: 'Type 2', chargingSpeed: 22, evIds: [{ status: '' }] }] }],
    }])[0];
    expect(station.connectors[0]).toMatchObject({ available: null, status: 'offline' });
  });

  it('supports the live EVCBatch envelope and field variants', () => {
    const service = new LtaDataMallService(new ConfigService({}));
    const station = service.normalizePayload({ LastUpdatedTime: '2026-08-18 15:40:00', evLocationsData: [{
      address: '2 Live Road Singapore 654321', postalCode: '654321', latitude: '1.31', longtitude: '103.81', name: 'Live Hub',
      chargingPoints: [{ operatingHours: '24 Hours', operator: 'Live EVCO', plugTypes: [{
        plugType: 'Combo 2', powerRating: '150', price: '0.6200', priceType: 'kWh',
        evIds: [{ evCpId: 'R123456A-001', status: 1 }],
      }, {
        plugType: 'Type 2', powerRating: '22', price: '', priceType: '', evIds: [{ evCpId: 'R123456A-002', status: 0 }],
      }], }],
    }] })[0];

    expect(station).not.toHaveProperty('operatingHours');
    expect(station).not.toHaveProperty('amenities');
    expect(station.pricePerKwh).toBe(0.62);
    expect(station.connectors).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'CCS2', powerKw: 150, available: 1 }),
      expect.objectContaining({ type: 'Type 2', powerKw: 22, available: 0, status: 'busy' }),
    ]));
  });
});
