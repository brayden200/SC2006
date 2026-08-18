import { Injectable } from '@nestjs/common';
import { StationsService } from '../stations/stations.service';

interface AvailabilityObservation {
  stationId: string;
  timestamp: Date;
  available: boolean;
}

@Injectable()
export class PredictionsService {
  private readonly observations: AvailabilityObservation[];

  constructor(private readonly stationsService: StationsService) {
    this.observations = this.buildHistory();
  }

  predict(stationId: string, arrivalTime: string) {
    const station = this.stationsService.findById(stationId);
    const arrival = new Date(arrivalTime);
    if (Number.isNaN(arrival.getTime())) {
      return { stationId, status: 'insufficient_data', message: 'Choose a valid arrival time.', sampleSize: 0 };
    }

    const targetDay = arrival.getDay();
    const targetHour = arrival.getHours();
    const matching = this.observations.filter(
      (item) =>
        item.stationId === stationId &&
        item.timestamp.getDay() === targetDay &&
        Math.abs(item.timestamp.getHours() - targetHour) <= 1,
    );

    if (matching.length < 5) {
      return {
        stationId,
        stationName: station.name,
        arrivalTime: arrival.toISOString(),
        status: 'insufficient_data',
        message: 'Not enough data for this weekday and time window.',
        sampleSize: matching.length,
      };
    }

    const availableCount = matching.filter((item) => item.available).length;
    const probability = Math.round((availableCount / matching.length) * 100);
    return {
      stationId,
      stationName: station.name,
      arrivalTime: arrival.toISOString(),
      status: 'prediction_available',
      probability,
      sampleSize: matching.length,
      confidence: matching.length >= 12 ? 'High' : matching.length >= 8 ? 'Medium' : 'Low',
      methodology: 'Similar weekday observations within one hour of the selected arrival time.',
      message: `${probability}% likelihood of at least one compatible charger being available.`,
    };
  }

  private buildHistory() {
    const history: AvailabilityObservation[] = [];
    const now = new Date();
    this.stationsService.getAll().forEach((station, stationIndex) => {
      const weeks = station.id === 'cw-tampines-hub' ? 2 : 16;
      for (let week = 1; week <= weeks; week += 1) {
        for (let hourOffset = -1; hourOffset <= 1; hourOffset += 1) {
          const timestamp = new Date(now);
          timestamp.setDate(now.getDate() - week * 7);
          timestamp.setHours(Math.max(0, Math.min(23, now.getHours() + hourOffset)), 0, 0, 0);
          const busyAtPeak = timestamp.getHours() >= 17 && timestamp.getHours() <= 20;
          const available = (week + hourOffset + stationIndex) % (busyAtPeak ? 3 : 5) !== 0;
          history.push({ stationId: station.id, timestamp, available });
        }
      }
    });
    return history;
  }
}
