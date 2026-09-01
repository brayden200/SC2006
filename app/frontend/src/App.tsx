import { useEffect, useState } from 'react'
import { ActionIcon, NavLink, Notification } from '@mantine/core'
import { Compass, Menu, Sparkles, X, Zap } from 'lucide-react'
import type { Page } from './types'
import { ExplorePage } from './pages/ExplorePage'
import { api } from './api'
import type { IntegrationProviderStatus } from './types'

const nav = [{ id: 'explore' as Page, label: 'Find a charger', icon: Compass }]

export default function App() {
  const [page, setPage] = useState<Page>('explore')
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [providers, setProviders] = useState<{
    ltaDataMall: IntegrationProviderStatus
    oneMap: IntegrationProviderStatus
    parking: { ura: IntegrationProviderStatus; hdb: IntegrationProviderStatus }
  } | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const update = () =>
      void api
        .getIntegrationStatus()
        .then(setProviders)
        .catch(() => undefined)
    update()
    const timer = window.setInterval(update, 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const providerLabel =
    providers?.ltaDataMall.state === 'available'
      ? `LTA DataMall live${providers.oneMap.state === 'available' ? ' · OneMap connected' : ''}`
      : providers?.ltaDataMall.state === 'error'
        ? 'Live charging data temporarily unavailable'
        : providers?.ltaDataMall.configured
          ? 'Live charging data ready'
          : 'Live charging data setup required'

  const navigate = (next: Page) => {
    setPage(next)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">
            <Zap size={20} strokeWidth={2.7} />
          </span>
          <span>
            ChargeWise <b>SG</b>
          </span>
        </div>
        <ActionIcon
          className="mobile-close icon-button"
          variant="default"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </ActionIcon>
        <p className="nav-label">Plan your charge</p>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <NavLink
              component="button"
              type="button"
              className={`nav-item ${page === id ? 'active' : ''}`}
              active={page === id}
              onClick={() => navigate(id)}
              key={id}
              label={label}
              leftSection={<Icon size={19} />}
            />
          ))}
        </nav>
        <div className="sidebar-tip">
          <span className="tip-icon">
            <Sparkles size={17} />
          </span>
          <div>
            <b>Smarter than nearest</b>
            <p>
              Every recommendation weighs availability, speed and savings, then uses distance to break ties.
            </p>
          </div>
        </div>
        <div className="sidebar-footer">
          <div>
            <b>Local ChargeWise app</b>
            <span>No account or charging history is stored.</span>
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />
      )}

      <main className="main-content">
        <header className="topbar">
          <ActionIcon
            className="mobile-menu icon-button"
            variant="default"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </ActionIcon>
          <div className="mobile-brand">
            <Zap size={18} />
            <span>ChargeWise SG</span>
          </div>
          <div className="live-indicator">
            <span /> {providerLabel}
          </div>
        </header>
        {page === 'explore' && <ExplorePage notify={setToast} />}
      </main>

      {toast && (
        <Notification
          className="toast"
          role="status"
          withCloseButton={false}
          icon={<Zap size={17} />}
          color="lime"
        >
          {toast}
        </Notification>
      )}
    </div>
  )
}
