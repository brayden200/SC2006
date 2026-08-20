import type { Station } from '../../common/types'
import type { ParkingMatch, ParkingRecord } from './parking.types'

// 75 m is the nearest-only safety limit; name/address evidence can extend to 300 m.
const MAX_NEAREST_ONLY_KM = 0.075
const MAX_EVIDENCE_MATCH_KM = 0.3

export function associateChargerToCarPark(
  station: Station,
  records: ParkingRecord[],
  explicitCarParkId?: string,
): ParkingMatch | null {
  if (explicitCarParkId) {
    const explicit = records.find((record) => record.carParkId === explicitCarParkId)
    if (explicit) {
      return {
        record: explicit,
        method: 'explicit',
        confidence: 'high',
        distanceKm: distanceKm(station.latitude, station.longitude, explicit.latitude, explicit.longitude),
      }
    }
  }
  const candidates = records
    .map((record) => ({
      record,
      distanceKm: distanceKm(station.latitude, station.longitude, record.latitude, record.longitude),
    }))
    .filter((candidate) => candidate.distanceKm <= MAX_EVIDENCE_MATCH_KM)
  if (!candidates.length) return null

  const stationAddress = normalize(station.address)
  const stationName = normalize(station.name)
  const postal = station.postalCode.trim()
  const scored = candidates
    .map((candidate) => {
      const addressEvidence =
        postal &&
        (candidate.record.postalCode === postal || normalize(candidate.record.address).includes(postal))
      const nameTokens = meaningfulTokens(stationName)
      const recordTokens = new Set([
        ...meaningfulTokens(normalize(candidate.record.name)),
        ...meaningfulTokens(normalize(candidate.record.address)),
      ])
      const overlap = nameTokens.filter((token) => recordTokens.has(token)).length
      const addressOverlap = meaningfulTokens(stationAddress).filter((token) =>
        recordTokens.has(token),
      ).length
      const explicit =
        station.id === candidate.record.carParkId ||
        stationAddress.includes(normalize(candidate.record.carParkId))
      return { ...candidate, addressEvidence, overlap, addressOverlap, explicit }
    })
    .sort((a, b) => {
      const score = (item: (typeof scored)[number]) =>
        Number(item.explicit) * 100 +
        Number(item.addressEvidence) * 50 +
        item.overlap * 8 +
        item.addressOverlap * 3 -
        item.distanceKm
      return score(b) - score(a)
    })

  const best = scored[0]
  if (best.explicit)
    return { record: best.record, method: 'explicit', confidence: 'high', distanceKm: best.distanceKm }
  if (best.addressEvidence || best.addressOverlap >= 2) {
    return {
      record: best.record,
      method: 'postal_or_address',
      confidence: best.addressEvidence ? 'high' : 'medium',
      distanceKm: best.distanceKm,
    }
  }
  if (best.overlap >= 2 && best.distanceKm <= MAX_EVIDENCE_MATCH_KM) {
    return {
      record: best.record,
      method: 'name_and_proximity',
      confidence: 'medium',
      distanceKm: best.distanceKm,
    }
  }
  if (best.distanceKm <= MAX_NEAREST_ONLY_KM) {
    return {
      record: best.record,
      method: 'nearest_proximity',
      confidence: 'low',
      distanceKm: best.distanceKm,
    }
  }
  return null
}

export function normalizeParkingText(value: string) {
  return normalize(value)
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/singapore/g, ' ')
    .replace(/\b(blk|block|car park|carpark|cp)\b/g, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function meaningfulTokens(value: string) {
  return value.split(' ').filter((token) => token.length >= 3 && !/^\d+$/.test(token))
}

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const radians = (value: number) => (value * Math.PI) / 180
  const dLat = radians(bLat - aLat)
  const dLon = radians(bLon - aLon)
  const lat1 = radians(aLat)
  const lat2 = radians(bLat)
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}
