import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Loader, NumberInput, Select, SimpleGrid, Textarea, TextInput } from '@mantine/core';
import {
  BatteryCharging,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  Leaf,
  MapPin,
  Plus,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { api, type SessionsResponse } from '../api';
import { Modal } from '../components/Modal';
import { toLocalInput } from '../lib';
import type { Station } from '../types';

export function HistoryPage({ notify }: { notify: (message: string) => void }) {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    stationId: 'cw-orchard-central',
    startedAt: toLocalInput(new Date()),
    energyKwh: '32',
    totalCost: '18.50',
    durationMinutes: '38',
    officialStatusAccurate: 'true',
    note: '',
  });
  const load = async () => {
    setLoading(true);
    try {
      const [sessions, stationData] = await Promise.all([
        api.getSessions(),
        api.searchStations({ query: 'Singapore', radiusKm: 50, includeUnknown: true }),
      ]);
      setData(sessions);
      setStations(stationData.stations);
      setForm((current) =>
        stationData.stations.some((station) => station.id === current.stationId)
          ? current
          : { ...current, stationId: stationData.stations[0]?.id ?? current.stationId },
      );
    } catch (reason) {
      notify((reason as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.createSession({
        ...form,
        startedAt: new Date(form.startedAt).toISOString(),
        energyKwh: Number(form.energyKwh),
        totalCost: Number(form.totalCost),
        durationMinutes: Number(form.durationMinutes),
        officialStatusAccurate: form.officialStatusAccurate === 'true',
      });
      setFormOpen(false);
      await load();
      notify('Charging session saved');
    } catch (reason) {
      notify((reason as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const maxCost = Math.max(1, ...(data?.sessions.map((item) => item.totalCost) ?? [1]));
  return (
    <div className="page history-page">
      <section className="page-heading split-heading">
        <div>
          <span className="eyebrow">YOUR CHARGING LOG</span>
          <h1>
            Know where your <em>energy goes.</em>
          </h1>
          <p>Track charging activity, cost and the accuracy of official status data.</p>
        </div>
        <Button className="add-session" leftSection={<Plus size={17} />} onClick={() => setFormOpen(true)}>
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
              <article>
                <span>
                  <MapPin />
                </span>
                <div>
                  <small>MOST VISITED</small>
                  <b className="station-summary">{data.summary.frequentlyUsedStation?.name ?? '—'}</b>
                  <p>{data.summary.frequentlyUsedStation?.visits ?? 0} recorded visits</p>
                </div>
              </article>
            </div>
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
                <div>
                  <CheckCircle2 size={16} /> User entries stay clearly marked
                </div>
              </div>
            </section>
            <section className="session-list card">
              <div className="section-title">
                <div>
                  <h2>Charging sessions</h2>
                  <p>{data.sessions.length} records · newest first</p>
                </div>
              </div>
              <div className="session-table">
                <div className="session-row header">
                  <span>Station</span>
                  <span>Date</span>
                  <span>Energy</span>
                  <span>Duration</span>
                  <span>Cost</span>
                  <span>Status accuracy</span>
                </div>
                {data.sessions.map((session) => (
                  <div className="session-row" key={session.id}>
                    <span className="session-station">
                      <i>
                        <BatteryCharging size={17} />
                      </i>
                      <b>{session.stationName}</b>
                      <small>User submitted</small>
                    </span>
                    <span>
                      {new Date(session.startedAt).toLocaleDateString([], {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span>{session.energyKwh} kWh</span>
                    <span>{session.durationMinutes} min</span>
                    <span>
                      <b>${session.totalCost.toFixed(2)}</b>
                    </span>
                    <span className={session.officialStatusAccurate ? 'accurate' : 'inaccurate'}>
                      {session.officialStatusAccurate ? 'Accurate' : 'Not accurate'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )
      )}
      {formOpen && (
        <Modal
          title="Record charging session"
          subtitle="Add the actual energy, cost and duration"
          onClose={() => setFormOpen(false)}
        >
          <form className="session-form" onSubmit={(event) => void submit(event)}>
            <Select
              required
              searchable
              label="Charging station"
              value={form.stationId}
              onChange={(value) => value && setForm({ ...form, stationId: value })}
              data={stations.map((station) => ({ value: station.id, label: station.name }))}
              allowDeselect={false}
            />
            <TextInput
              required
              type="datetime-local"
              label="Date and start time"
              value={form.startedAt}
              onChange={(event) => setForm({ ...form, startedAt: event.currentTarget.value })}
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
                onChange={(value) => setForm({ ...form, energyKwh: String(value) })}
              />
              <NumberInput
                required
                label="Total cost (S$)"
                min={0}
                max={1000}
                step={0.01}
                decimalScale={2}
                value={form.totalCost}
                onChange={(value) => setForm({ ...form, totalCost: String(value) })}
              />
              <NumberInput
                required
                label="Duration (minutes)"
                min={1}
                max={1440}
                value={form.durationMinutes}
                onChange={(value) => setForm({ ...form, durationMinutes: String(value) })}
              />
              <Select
                label="Was official status accurate?"
                value={form.officialStatusAccurate}
                onChange={(value) => value && setForm({ ...form, officialStatusAccurate: value })}
                data={[
                  { value: 'true', label: 'Yes, accurate' },
                  { value: 'false', label: 'No, inaccurate' },
                ]}
                allowDeselect={false}
              />
            </SimpleGrid>
            <Textarea
              label="Note (optional)"
              rows={3}
              placeholder="Anything useful about this charge…"
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.currentTarget.value })}
            />
            <Alert className="form-note" color="yellow" icon={<Clock3 size={16} />}>
              This record is labeled as user-submitted data.
            </Alert>
            <Button type="submit" fullWidth loading={saving} leftSection={<Plus size={17} />}>
              Save session
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
