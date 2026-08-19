import { BadRequestException, Injectable } from '@nestjs/common';
import { ConnectorPreference, ConnectorType, RankedStation, Station } from '../common/types';
import { StationsService } from '../stations/stations.service';
import { CompareStationsDto, RecommendationDto } from './dto/recommendation.dto';
import { OneMapService, RouteResult } from '../integrations/onemap.service';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly stationsService: StationsService,
    private readonly oneMap: OneMapService,
  ) {}

  async recommend(dto: RecommendationDto) {
    const search = await this.stationsService.search({
      latitude: dto.latitude,
      longitude: dto.longitude,
      radiusKm: dto.radiusKm ?? 8,
      connector: dto.connector === 'Any' ? undefined : dto.connector,
      maxPrice: dto.maxPrice,
      minPowerKw: dto.minPowerKw,
      availableOnly: dto.availableOnly,
      includeUnknown: dto.includeUnknown ?? false,
      operator: dto.operator,
    });
    const ranked = (
      await Promise.all(
        search.stations.map(async (station, index) => {
          let route: RouteResult | null = null;
          if (index < 8) {
            try {
              route = await this.oneMap.drivingRoute(dto, station);
            } catch {
              route = null;
            }
          }
          return this.rankStation(station, dto, route);
        }),
      )
    ).sort((a, b) => b.score - a.score);

    return {
      recommended: ranked[0] ?? null,
      alternatives: ranked.slice(1, 3),
      ranked,
      location: search.location,
      disclaimer: 'Availability can change before you arrive. Check the latest status before travelling.',
      scoringModel: {
        availability: dto.availabilityWeight ?? 30,
        travelTime: dto.travelWeight ?? 25,
        chargingSpeed: dto.speedWeight ?? 20,
        price: dto.priceWeight ?? 15,
        preference: dto.preferenceWeight ?? 10,
      },
      dataStatus: search.dataStatus,
    };
  }

  rankStation(
    station: Station & { distanceKm?: number },
    dto: RecommendationDto,
    route: RouteResult | null = null,
  ): RankedStation {
    const connector = this.selectConnector(station, dto.connector, dto);
    if (!connector) throw new BadRequestException('Incompatible station was sent for ranking');

    const distanceKm =
      route?.distanceKm ?? station.distanceKm ?? this.stationsService.distanceKm(dto, station);
    const availability = connector.available === null ? 35 : (connector.available / connector.total) * 100;
    const powerKw = connector.powerKw > 0 ? connector.powerKw : null;
    const pricePerKwh = station.pricePerKwh !== null && station.pricePerKwh > 0 ? station.pricePerKwh : null;
    const travelMinutes = route?.travelMinutes ?? Math.max(2, Math.round((distanceKm / 25) * 60));
    const travelTime = route
      ? Math.max(0, 100 - (travelMinutes / 45) * 100)
      : Math.max(0, 100 - (distanceKm / Math.max(dto.radiusKm ?? 8, 1)) * 100);
    const chargingSpeed = powerKw === null ? 0 : Math.min(100, (powerKw / 200) * 100);
    const price =
      pricePerKwh === null ? null : Math.max(0, Math.min(100, 100 - ((pricePerKwh - 0.4) / 0.4) * 100));
    const preference = dto.preferredOperator ? (station.operator === dto.preferredOperator ? 100 : 35) : 70;

    const rawWeights = {
      availability: dto.availabilityWeight ?? 30,
      travelTime: dto.travelWeight ?? 25,
      chargingSpeed: dto.speedWeight ?? 20,
      price: price === null ? 0 : (dto.priceWeight ?? 15),
      preference: dto.preferenceWeight ?? 10,
    };
    const weightTotal = Object.values(rawWeights).reduce((sum, value) => sum + value, 0) || 1;
    const score =
      (availability * rawWeights.availability +
        travelTime * rawWeights.travelTime +
        chargingSpeed * rawWeights.chargingSpeed +
        (price ?? 0) * rawWeights.price +
        preference * rawWeights.preference) /
      weightTotal;

    const estimatedChargeMinutes =
      powerKw === null ? null : Math.max(10, Math.round(((dto.energyKwh ?? 35) / powerKw) * 60 * 1.12));
    const estimatedCost =
      pricePerKwh === null ? null : Number((pricePerKwh * (dto.energyKwh ?? 35)).toFixed(2));

    const reasons: string[] = [];
    if (price === null) reasons.push('Price is unknown and was excluded from scoring');
    if ((connector.available ?? 0) > 0)
      reasons.push(
        `${connector.available} compatible charger${connector.available === 1 ? '' : 's'} available now`,
      );
    if ((powerKw ?? 0) >= 100) reasons.push(`Fast ${powerKw} kW charging`);
    if (distanceKm < 3) reasons.push(`Only ${travelMinutes} minutes away`);
    if (pricePerKwh !== null && pricePerKwh <= 0.55)
      reasons.push(`Competitive rate of $${pricePerKwh.toFixed(2)}/kWh`);
    if (dto.preferredOperator === station.operator) reasons.push(`Matches your preferred operator`);
    if (dto.connector === 'Any') reasons.unshift(`${connector.type} selected as the best connector`);

    return {
      ...structuredClone(station),
      selectedConnector: connector.type,
      pricePerKwh,
      score: Math.round(score),
      distanceKm,
      travelMinutes,
      travelSource: route ? 'OneMap' : 'Straight-line estimate',
      estimatedCost,
      estimatedChargeMinutes,
      scoreBreakdown: {
        availability: Math.round(availability),
        travelTime: Math.round(travelTime),
        chargingSpeed: Math.round(chargingSpeed),
        price: price === null ? null : Math.round(price),
        preference: Math.round(preference),
      },
      reasons: reasons.slice(0, 3),
    };
  }

  async compare(dto: CompareStationsDto) {
    if (dto.stationIds.length < 2 || dto.stationIds.length > 4) {
      throw new BadRequestException('Choose between two and four stations to compare');
    }
    const stations = dto.stationIds.map((id) => this.stationsService.findById(id));
    const origin = { latitude: dto.latitude ?? 1.3048, longitude: dto.longitude ?? 103.8318 };
    const options = await Promise.all(
      stations.map(async (station) => {
        const connector = this.selectConnector(station, dto.connector);
        const powerKw = connector && connector.powerKw > 0 ? connector.powerKw : null;
        const pricePerKwh =
          station.pricePerKwh !== null && station.pricePerKwh > 0 ? station.pricePerKwh : null;
        let route: RouteResult | null = null;
        try {
          route = await this.oneMap.drivingRoute(origin, station);
        } catch {
          route = null;
        }
        const distanceKm = route?.distanceKm ?? this.stationsService.distanceKm(origin, station);
        return {
          id: station.id,
          name: station.name,
          operator: station.operator,
          connector: connector?.type ?? null,
          connectorCompatible: Boolean(connector),
          availability: connector?.available ?? null,
          availabilityStatus: connector?.status ?? 'unknown',
          powerKw,
          estimatedChargeMinutes: powerKw
            ? Math.max(10, Math.round(((dto.energyKwh ?? 35) / powerKw) * 60 * 1.12))
            : null,
          pricePerKwh,
          estimatedCost:
            pricePerKwh === null ? null : Number((pricePerKwh * (dto.energyKwh ?? 35)).toFixed(2)),
          distanceKm,
          travelMinutes: route?.travelMinutes ?? Math.max(2, Math.round((distanceKm / 25) * 60)),
          travelSource: route ? 'OneMap' : 'Straight-line estimate',
          lastUpdated: station.lastUpdated,
        };
      }),
    );

    const known = (key: keyof (typeof options)[number]) =>
      options.filter((item) => typeof item[key] === 'number');
    const highlights: Record<string, { best: string[]; weakest: string[] }> = {};
    const directions: Array<{ key: keyof (typeof options)[number]; direction: 'max' | 'min' }> = [
      { key: 'availability', direction: 'max' },
      { key: 'powerKw', direction: 'max' },
      { key: 'estimatedChargeMinutes', direction: 'min' },
      { key: 'pricePerKwh', direction: 'min' },
      { key: 'estimatedCost', direction: 'min' },
      { key: 'travelMinutes', direction: 'min' },
    ];
    directions.forEach(({ key, direction }) => {
      const values = known(key);
      if (!values.length) return;
      const nums = values.map((item) => item[key] as number);
      const bestValue = direction === 'max' ? Math.max(...nums) : Math.min(...nums);
      const weakestValue = direction === 'max' ? Math.min(...nums) : Math.max(...nums);
      highlights[key] = {
        best: values.filter((item) => item[key] === bestValue).map((item) => item.id),
        weakest: values.filter((item) => item[key] === weakestValue).map((item) => item.id),
      };
    });

    return { connector: dto.connector, energyKwh: dto.energyKwh ?? 35, options, highlights };
  }

  private selectConnector(
    station: Station,
    preference: ConnectorPreference,
    filters?: Pick<
      RecommendationDto,
      'availableOnly' | 'includeUnknown' | 'minPowerKw' | 'availabilityWeight' | 'speedWeight'
    >,
  ) {
    if (preference !== 'Any') {
      return station.connectors.find((connector) => connector.type === preference);
    }

    const eligible = station.connectors.filter(
      (connector) =>
        (!filters?.availableOnly || (connector.status === 'available' && (connector.available ?? 0) > 0)) &&
        (filters?.includeUnknown || connector.status !== 'unknown') &&
        (filters?.minPowerKw === undefined || connector.powerKw >= filters.minPowerKw),
    );
    const candidates = eligible.length ? eligible : station.connectors;
    const availabilityWeight = filters?.availabilityWeight ?? 30;
    const speedWeight = filters?.speedWeight ?? 20;
    return [...candidates].sort((a, b) => {
      const score = (connector: (typeof candidates)[number]) => {
        const availability =
          connector.available === null ? 35 : (connector.available / Math.max(connector.total, 1)) * 100;
        const speed = Math.min(100, (connector.powerKw / 200) * 100);
        return availability * availabilityWeight + speed * speedWeight;
      };
      return score(b) - score(a);
    })[0];
  }
}
