const A = 6378137
const F = 1 / 298.257223563
const ORIGIN_LAT = (1 + 22 / 60) * (Math.PI / 180)
const ORIGIN_LON = (103 + 50 / 60) * (Math.PI / 180)
const SCALE = 1
const FALSE_EASTING = 28001.642
const FALSE_NORTHING = 38744.572

export interface Coordinates {
  latitude: number
  longitude: number
}

/** Converts official Singapore SVY21 (easting, northing) coordinates to WGS84. */
export function svy21ToWgs84(easting: number, northing: number): Coordinates | null {
  if (!Number.isFinite(easting) || !Number.isFinite(northing)) return null

  const eccentricitySquared = F * (2 - F)
  const eccentricityPrimeSquared = eccentricitySquared / (1 - eccentricitySquared)
  const x = easting - FALSE_EASTING
  const y = northing - FALSE_NORTHING
  const meridionalOrigin = meridionalArc(ORIGIN_LAT, eccentricitySquared)
  const mu =
    (meridionalOrigin + y / SCALE) / (A * (1 - eccentricitySquared / 4 - (3 * eccentricitySquared ** 2) / 64))
  const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) / (1 + Math.sqrt(1 - eccentricitySquared))
  const footprint =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu)
  const sinFootprint = Math.sin(footprint)
  const cosFootprint = Math.cos(footprint)
  const tanFootprint = Math.tan(footprint)
  const radiusPrime = A / Math.sqrt(1 - eccentricitySquared * sinFootprint ** 2)
  const radiusMeridian =
    (A * (1 - eccentricitySquared)) / (1 - eccentricitySquared * sinFootprint ** 2) ** 1.5
  const t = tanFootprint ** 2
  const c = eccentricityPrimeSquared * cosFootprint ** 2
  const d = x / (radiusPrime * SCALE)

  const latitude =
    footprint -
    ((radiusPrime * tanFootprint) / radiusMeridian) *
      (d ** 2 / 2 -
        ((5 + 3 * t + 10 * c - 4 * c ** 2 - 9 * eccentricityPrimeSquared) * d ** 4) / 24 +
        ((61 + 90 * t + 298 * c + 45 * t ** 2 - 252 * eccentricityPrimeSquared - 3 * c ** 2) * d ** 6) / 720)
  const longitude =
    ORIGIN_LON +
    (d -
      ((1 + 2 * t + c) * d ** 3) / 6 +
      ((5 - 2 * c + 28 * t - 3 * c ** 2 + 8 * eccentricityPrimeSquared + 24 * t ** 2) * d ** 5) / 120) /
      cosFootprint

  return { latitude: (latitude * 180) / Math.PI, longitude: (longitude * 180) / Math.PI }
}

function meridionalArc(latitude: number, eccentricitySquared: number) {
  return (
    A *
    ((1 -
      eccentricitySquared / 4 -
      (3 * eccentricitySquared ** 2) / 64 -
      (5 * eccentricitySquared ** 3) / 256) *
      latitude -
      ((3 * eccentricitySquared) / 8 +
        (3 * eccentricitySquared ** 2) / 32 +
        (45 * eccentricitySquared ** 3) / 1024) *
        Math.sin(2 * latitude) +
      ((15 * eccentricitySquared ** 2) / 256 + (45 * eccentricitySquared ** 3) / 1024) *
        Math.sin(4 * latitude) -
      ((35 * eccentricitySquared ** 3) / 3072) * Math.sin(6 * latitude))
  )
}
