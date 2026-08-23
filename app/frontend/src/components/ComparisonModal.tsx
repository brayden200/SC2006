import { useEffect, useState } from 'react'
import { Alert, Button, Loader } from '@mantine/core'
import { Check } from 'lucide-react'
import { api, type CompareResponse } from '../api'
import { formatPrice, hasKnownPrice } from '../lib'
import type { ConnectorPreference, RankedStation } from '../types'
import { Modal } from './Modal'

export function ComparisonModal({
  stations,
  connector,
  energyKwh,
  location,
  onClose,
  onChoose,
}: {
  stations: RankedStation[]
  connector: ConnectorPreference
  energyKwh: number
  location: { latitude: number; longitude: number }
  onClose: () => void
  onChoose: (station: RankedStation) => void
}) {
  const [data, setData] = useState<CompareResponse | null>(null)
  const [error, setError] = useState('')
  const [activeStationId, setActiveStationId] = useState(stations[0]?.id ?? '')
  useEffect(() => {
    api
      .compare({
        stationIds: stations.map((item) => item.id),
        connector,
        energyKwh,
        latitude: location.latitude,
        longitude: location.longitude,
      })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [stations, connector, energyKwh, location])

  const rows: Array<{
    key: keyof NonNullable<CompareResponse['options'][number]>
    label: string
    value: (value: CompareResponse['options'][number]) => string
    rankDirection?: 'higher' | 'lower'
  }> = [
    {
      key: 'connector',
      label: 'Connector used',
      value: (item) => item.connector ?? 'Unavailable',
    },
    {
      key: 'availability',
      label: 'Available now',
      rankDirection: 'higher',
      value: (item) =>
        item.availability === null
          ? 'Unknown'
          : `${item.availability} charger${item.availability === 1 ? '' : 's'}`,
    },
    {
      key: 'powerKw',
      label: 'Charging speed',
      rankDirection: 'higher',
      value: (item) => (item.powerKw === null ? 'Unknown' : `${item.powerKw} kW`),
    },
    {
      key: 'estimatedChargeMinutes',
      label: 'Est. charge time',
      rankDirection: 'lower',
      value: (item) =>
        item.estimatedChargeMinutes === null ? 'Unknown' : `${item.estimatedChargeMinutes} min`,
    },
    {
      key: 'pricePerKwh',
      label: 'Price',
      rankDirection: 'lower',
      value: (item) => (hasKnownPrice(item.pricePerKwh) ? `${formatPrice(item.pricePerKwh)}/kWh` : 'Unknown'),
    },
    {
      key: 'estimatedCost',
      label: `Est. cost (${energyKwh} kWh)`,
      rankDirection: 'lower',
      value: (item) => formatPrice(item.estimatedCost),
    },
    {
      key: 'parkingRateText',
      label: 'Parking rate/status',
      value: (item) =>
        item.parkingRateText ??
        (item.parkingEstimateStatus === 'unavailable' ? 'Unavailable' : 'See published rate'),
    },
    {
      key: 'estimatedParkingCost',
      label: 'Est. parking cost',
      rankDirection: 'lower',
      value: (item) => formatPrice(item.estimatedParkingCost),
    },
    {
      key: 'estimatedTotalCost',
      label: 'Est. total visit cost',
      rankDirection: 'lower',
      value: (item) => formatPrice(item.estimatedTotalCost),
    },
    {
      key: 'travelMinutes',
      label: 'Travel time',
      rankDirection: 'lower',
      value: (item) => `${item.travelMinutes} min`,
    },
    { key: 'travelSource', label: 'Travel data', value: (item) => item.travelSource },
    { key: 'operator', label: 'Operator', value: (item) => item.operator },
  ]

  const activeOption = data?.options.find((item) => item.id === activeStationId) ?? data?.options[0]

  const rankFor = (row: (typeof rows)[number], item: CompareResponse['options'][number]) => {
    if (!row.rankDirection || typeof item[row.key] !== 'number' || !data) return null
    const values = [
      ...new Set(
        data.options
          .map((option) => option[row.key])
          .filter((value): value is number => typeof value === 'number'),
      ),
    ].sort((a, b) => (row.rankDirection === 'higher' ? b - a : a - b))
    const rank = values.indexOf(item[row.key] as number) + 1
    return rank > 0 ? rank : null
  }

  const ordinal = (rank: number) => {
    const remainder = rank % 100
    if (remainder >= 11 && remainder <= 13) return `${rank}th`
    return `${rank}${rank % 10 === 1 ? 'st' : rank % 10 === 2 ? 'nd' : rank % 10 === 3 ? 'rd' : 'th'}`
  }

  const chooseStation = (stationId: string) => {
    const station = stations.find((item) => item.id === stationId)
    if (station) onChoose(station)
  }

  return (
    <Modal
      title="Compare charging options"
      subtitle={`${connector === 'Any' ? 'Best connector per station' : connector} · visit estimates based on ${energyKwh} kWh added`}
      onClose={onClose}
      wide
      mobileFullScreen
      bodyClassName="comparison-modal-body"
    >
      {!data && !error && (
        <div className="loading-state">
          <Loader /> Comparing live options…
        </div>
      )}
      {error && <Alert color="red">{error}</Alert>}
      {data && (
        <>
          <div className="comparison-mobile">
            <div className="comparison-station-tabs" role="tablist" aria-label="Stations to compare">
              {data.options.map((item) => {
                const isActive = item.id === activeOption?.id
                const firstPlaceCount = rows.filter((row) => rankFor(row, item) === 1).length
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={isActive ? 'active' : ''}
                    onClick={() => setActiveStationId(item.id)}
                  >
                    <span>{item.name}</span>
                    <small>
                      {firstPlaceCount} first-place metric{firstPlaceCount === 1 ? '' : 's'}
                    </small>
                  </button>
                )
              })}
            </div>

            {activeOption && (
              <section className="comparison-mobile-panel" role="tabpanel">
                <div className="comparison-mobile-heading">
                  <div>
                    <span>Viewing</span>
                    <h3>{activeOption.name}</h3>
                    <p>{activeOption.operator}</p>
                  </div>
                  <span className="comparison-position">
                    {data.options.findIndex((item) => item.id === activeOption.id) + 1} of{' '}
                    {data.options.length}
                  </span>
                </div>

                <dl className="comparison-mobile-metrics">
                  {rows.map((row) => {
                    const rank = rankFor(row, activeOption)
                    return (
                      <div key={row.key} className={rank === 1 ? 'metric-best' : ''}>
                        <dt>{row.label}</dt>
                        <dd>
                          <span>{row.value(activeOption)}</span>
                          {rank && <small className={`metric-place place-${rank}`}>{ordinal(rank)}</small>}
                        </dd>
                      </div>
                    )
                  })}
                </dl>

                <div className="comparison-mobile-action">
                  <div>
                    <small>Selected station</small>
                    <b>{activeOption.name}</b>
                  </div>
                  <Button leftSection={<Check size={16} />} onClick={() => chooseStation(activeOption.id)}>
                    Choose
                  </Button>
                </div>
              </section>
            )}
          </div>

          <div className="compare-scroll comparison-desktop">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Compare</th>
                  {data.options.map((item) => (
                    <th key={item.id}>
                      <b>{item.name}</b>
                      <span>{item.operator}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th>{row.label}</th>
                    {data.options.map((item) => {
                      const rank = rankFor(row, item)
                      return (
                        <td key={item.id} className={rank === 1 ? 'cell-best' : ''}>
                          {row.value(item)}
                          {rank && <small className={`metric-place place-${rank}`}>{ordinal(rank)}</small>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr className="choose-row">
                  <th>Your choice</th>
                  {data.options.map((item) => (
                    <td key={item.id}>
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<Check size={15} />}
                        onClick={() => chooseStation(item.id)}
                      >
                        Choose
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  )
}
