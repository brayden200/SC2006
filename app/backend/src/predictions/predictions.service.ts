import { Injectable } from '@nestjs/common'
import { StationsService } from '../stations/stations.service'

@Injectable()
export class PredictionsService {
  constructor(private readonly stationsService: StationsService) {}

  predict(stationId: string, arrivalTime: string) {
    const station = this.stationsService.findById(stationId)
    const arrival = new Date(arrivalTime)
    if (Number.isNaN(arrival.getTime())) {
      return {
        stationId,
        status: 'insufficient_data',
        message: 'Choose a valid arrival time.',
        sampleSize: 0,
      }
    }

    const targetDay = arrival.getDay()
    const targetHour = arrival.getHours()
    const matching = this.stationsService
      .getAvailabilityObservations(stationId)
      .filter(
        (item) =>
          item.stationId === stationId &&
          item.timestamp.getDay() === targetDay &&
          Math.abs(item.timestamp.getHours() - targetHour) <= 1,
      )

    if (matching.length < 5) {
      return {
        stationId,
        stationName: station.name,
        arrivalTime: arrival.toISOString(),
        status: 'insufficient_data',
        message: 'Not enough live observations have been collected for this weekday and time window.',
        sampleSize: matching.length,
      }
    }

    const availableCount = matching.filter((item) => item.available).length
    const probability = Math.round((availableCount / matching.length) * 100)
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
    }
  }
}
