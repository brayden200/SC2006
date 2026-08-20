import { useEffect, useState } from 'react'
import { Alert, Button, Loader } from '@mantine/core'
import { Check, Minus, Trophy } from 'lucide-react'
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
  }> = [
    {
      key: 'connector',
      label: 'Connector used',
      value: (item) => item.connector ?? 'Unavailable',
    },
    {
      key: 'availability',
      label: 'Available now',
      value: (item) =>
        item.availability === null
          ? 'Unknown'
          : `${item.availability} charger${item.availability === 1 ? '' : 's'}`,
    },
    {
      key: 'powerKw',
      label: 'Charging speed',
      value: (item) => (item.powerKw === null ? 'Unknown' : `${item.powerKw} kW`),
    },
    {
      key: 'estimatedChargeMinutes',
      label: 'Est. charge time',
      value: (item) =>
        item.estimatedChargeMinutes === null ? 'Unknown' : `${item.estimatedChargeMinutes} min`,
    },
    {
      key: 'pricePerKwh',
      label: 'Price',
      value: (item) => (hasKnownPrice(item.pricePerKwh) ? `${formatPrice(item.pricePerKwh)}/kWh` : 'Unknown'),
    },
    {
      key: 'estimatedCost',
      label: `Est. cost (${energyKwh} kWh)`,
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
      value: (item) => formatPrice(item.estimatedParkingCost),
    },
    {
      key: 'estimatedTotalCost',
      label: 'Est. total visit cost',
      value: (item) => formatPrice(item.estimatedTotalCost),
    },
    { key: 'travelMinutes', label: 'Travel time', value: (item) => `${item.travelMinutes} min` },
    { key: 'travelSource', label: 'Travel data', value: (item) => item.travelSource },
    { key: 'operator', label: 'Operator', value: (item) => item.operator },
  ]

  return (
    <Modal
      title="Compare charging options"
      subtitle={`${connector === 'Any' ? 'Best connector per station' : connector} · visit estimates based on ${energyKwh} kWh added`}
      onClose={onClose}
      wide
    >
      {!data && !error && (
        <div className="loading-state">
          <Loader /> Comparing live options…
        </div>
      )}
      {error && <Alert color="red">{error}</Alert>}
      {data && (
        <div className="compare-scroll">
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
                    const highlight = data.highlights[row.key]
                    const best = highlight?.best.includes(item.id)
                    const weak = highlight?.weakest.includes(item.id) && !best
                    return (
                      <td key={item.id} className={best ? 'cell-best' : weak ? 'cell-weak' : ''}>
                        {best && <Trophy size={14} />}
                        {weak && <Minus size={14} />}
                        {row.value(item)}
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
                      onClick={() => onChoose(stations.find((station) => station.id === item.id)!)}
                    >
                      Choose
                    </Button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
