import { FormEvent, useEffect, useState } from 'react'
import { Button, Loader, NumberInput, Select, SimpleGrid, TextInput } from '@mantine/core'
import { BatteryCharging, CalendarDays, DollarSign, Leaf, Plus, TrendingUp, Zap } from 'lucide-react'
import { api, type SessionsResponse, type StationOption } from '../api'
import { Modal } from '../components/Modal'
import { toLocalInput } from '../lib'

export function HistoryPage({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<SessionsResponse | null>(null)
  const [stations, setStations] = useState<StationOption[]>([])
  const [stationSearch, setStationSearch] = useState('')
  const [stationsLoading, setStationsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    stationId: '',
    startedAt: toLocalInput(new Date()),
    energyKwh: '',
    totalCost: '',
  })
  const load = async () => {
    setLoading(true)
    try {
      setData(await api.getSessions())
    } catch (reason) {
      notify((reason as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [])
  useEffect(() => {
    const query = stationSearch.trim()
    if (!formOpen || query.length < 2) {
      setStations([])
      setStationsLoading(false)
      return
    }
    if (form.stationId) {
      setStationsLoading(false)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setStationsLoading(true)
      try {
        const result = await api.searchStationOptions(query)
        if (!cancelled) {
          setStations([...new Map(result.stations.map((station) => [station.id, station])).values()])
        }
      } catch (reason) {
        if (!cancelled) {
          setStations([])
          notify((reason as Error).message)
        }
      } finally {
        if (!cancelled) setStationsLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [form.stationId, formOpen, stationSearch])
  const openForm = () => {
    setStations([])
    setStationSearch('')
    setFormError('')
    setForm({
      stationId: '',
      startedAt: toLocalInput(new Date()),
      energyKwh: '',
      totalCost: '',
    })
    setFormOpen(true)
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const energyKwh = Number(form.energyKwh)
    const totalCost = Number(form.totalCost)
    const startedAt = new Date(form.startedAt)
    const error = !form.stationId
      ? 'Select a charging station from the search results.'
      : !Number.isFinite(energyKwh) || energyKwh < 0.1 || energyKwh > 200
        ? 'Enter energy added between 0.1 and 200 kWh.'
        : form.totalCost === '' || !Number.isFinite(totalCost) || totalCost < 0 || totalCost > 1000
          ? 'Enter a total cost between S$0 and S$1,000.'
          : Number.isNaN(startedAt.getTime())
            ? 'Choose a valid session date and time.'
            : ''
    if (error) {
      setFormError(error)
      notify(error)
      return
    }
    setFormError('')
    setSaving(true)
    try {
      await api.createSession({
        stationId: form.stationId,
        startedAt: startedAt.toISOString(),
        energyKwh,
        totalCost,
      })
      setFormOpen(false)
      await load()
      notify('Charging session saved')
    } catch (reason) {
      notify((reason as Error).message)
    } finally {
      setSaving(false)
    }
  }
  const maxCost = Math.max(1, ...(data?.sessions.map((item) => item.totalCost) ?? [1]))
  return (
    <div className="page history-page">
      <section className="page-heading split-heading">
        <div>
          <span className="eyebrow">YOUR CHARGING LOG</span>
          <h1>
            Know where your <em>energy goes.</em>
          </h1>
          <p>Track the energy and cost from your charging sessions.</p>
        </div>
        <Button className="add-session" leftSection={<Plus size={17} />} onClick={openForm}>
          Record session
        </Button>
      </section>
      {loading ? (
        <div className="page-loading">
          <Loader size="md" />
          <h3>Calculating your charging summary…</h3>
        </div>
      ) : (
        data && (
          <>
            <div className="summary-grid">
              <article>
                <span>
                  <DollarSign />
                </span>
                <div>
                  <small>THIS MONTH</small>
                  <b>${data.summary.monthlyCost.toFixed(2)}</b>
                  <p>Total charging cost</p>
                </div>
              </article>
              <article>
                <span>
                  <Zap />
                </span>
                <div>
                  <small>ENERGY ADDED</small>
                  <b>
                    {data.summary.monthlyEnergyKwh} <i>kWh</i>
                  </b>
                  <p>Across {data.summary.monthlySessions} sessions</p>
                </div>
              </article>
              <article>
                <span>
                  <TrendingUp />
                </span>
                <div>
                  <small>AVERAGE RATE</small>
                  <b>
                    ${data.summary.averageCostPerKwh.toFixed(2)} <i>/ kWh</i>
                  </b>
                  <p>This month</p>
                </div>
              </article>
            </div>
            {data.sessions.length > 0 && (
              <section className="history-content">
                <div className="session-chart card">
                  <div className="section-title">
                    <div>
                      <h2>Cost by session</h2>
                      <p>Your latest charging records</p>
                    </div>
                    <span>
                      <CalendarDays size={16} /> Recent activity
                    </span>
                  </div>
                  <div className="bars">
                    {data.sessions
                      .slice(0, 8)
                      .reverse()
                      .map((session) => (
                        <div className="bar-column" key={session.id}>
                          <span className="bar-value">${session.totalCost.toFixed(0)}</span>
                          <div
                            className="bar"
                            style={{ height: `${Math.max(12, (session.totalCost / maxCost) * 100)}%` }}
                          />
                          <small>
                            {new Date(session.startedAt).toLocaleDateString([], {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </small>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="impact-card">
                  <span className="impact-icon">
                    <Leaf size={22} />
                  </span>
                  <small>CHARGING INSIGHT</small>
                  <h2>{data.summary.monthlyEnergyKwh} kWh logged</h2>
                  <p>Good records make future cost estimates and charger comparisons more useful.</p>
                </div>
              </section>
            )}
            <section className="session-list card">
              <div className="section-title">
                <div>
                  <h2>Charging sessions</h2>
                  <p>{data.sessions.length} records · newest first</p>
                </div>
              </div>
              {data.sessions.length === 0 ? (
                <div className="empty-state compact">
                  <BatteryCharging size={30} />
                  <h3>No charging sessions yet</h3>
                  <p>Record your first completed charge to start building your history.</p>
                  <Button leftSection={<Plus size={16} />} onClick={openForm}>
                    Record first session
                  </Button>
                </div>
              ) : (
                <div className="session-table">
                  <div className="session-row header">
                    <span>Station</span>
                    <span>Date</span>
                    <span>Energy</span>
                    <span>Cost</span>
                  </div>
                  {data.sessions.map((session) => (
                    <div className="session-row" key={session.id}>
                      <span title={session.stationName}>
                        <b>{session.stationName}</b>
                      </span>
                      <span>
                        {new Date(session.startedAt).toLocaleDateString([], {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span>{session.energyKwh} kWh</span>
                      <span>
                        <b>${session.totalCost.toFixed(2)}</b>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )
      )}
      {formOpen && (
        <Modal
          title="Record charging session"
          subtitle="Add the energy and total cost from your charge"
          onClose={() => setFormOpen(false)}
        >
          <form className="session-form" noValidate onSubmit={(event) => void submit(event)}>
            <Select
              required
              searchable
              label="Charging station"
              value={form.stationId}
              error={formError.includes('station') ? formError : undefined}
              searchValue={stationSearch}
              onSearchChange={(value) => {
                setStationSearch(value)
                setFormError('')
                const selected = stations.find((station) => `${station.name} — ${station.address}` === value)
                if (!selected) setForm((current) => ({ ...current, stationId: '' }))
              }}
              onChange={(value) => {
                const selected = stations.find((station) => station.id === value)
                setForm((current) => ({ ...current, stationId: value ?? '' }))
                setFormError('')
                if (selected) setStationSearch(`${selected.name} — ${selected.address}`)
              }}
              data={stations.map((station) => ({
                value: station.id,
                label: `${station.name} — ${station.address}`,
              }))}
              nothingFoundMessage={
                stationSearch.trim().length < 2 ? 'Type at least 2 characters' : 'No matching backend station'
              }
              rightSection={stationsLoading ? <Loader size={16} /> : undefined}
              allowDeselect={false}
            />
            <TextInput
              required
              type="datetime-local"
              label="Date and start time"
              value={form.startedAt}
              error={formError.includes('date') ? formError : undefined}
              onChange={(event) => {
                const startedAt = event.currentTarget.value
                setForm((current) => ({ ...current, startedAt }))
                setFormError('')
              }}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <NumberInput
                required
                label="Energy added (kWh)"
                min={0.1}
                max={200}
                step={0.1}
                decimalScale={1}
                value={form.energyKwh}
                error={formError.includes('energy') ? formError : undefined}
                onChange={(value) => {
                  setForm((current) => ({ ...current, energyKwh: String(value) }))
                  setFormError('')
                }}
              />
              <NumberInput
                required
                label="Total cost (S$)"
                min={0}
                max={1000}
                step={0.01}
                decimalScale={2}
                value={form.totalCost}
                error={formError.includes('cost') ? formError : undefined}
                onChange={(value) => {
                  setForm((current) => ({ ...current, totalCost: String(value) }))
                  setFormError('')
                }}
              />
            </SimpleGrid>
            <Button
              type="submit"
              fullWidth
              loading={saving}
              disabled={!form.stationId}
              leftSection={<Plus size={17} />}
            >
              Save session
            </Button>
          </form>
        </Modal>
      )}
    </div>
  )
}
