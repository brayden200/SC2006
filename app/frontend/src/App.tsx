import { useEffect, useState } from 'react'
import { Notification } from '@mantine/core'
import { Zap } from 'lucide-react'
import { ExplorePage } from './pages/ExplorePage'
import { api } from './api'
import type { IntegrationProviderStatus } from './types'

export default function App() {
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

  return (
    <div className="app-shell">
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <span className="brand-mark">
                <Zap size={19} strokeWidth={2.7} />
              </span>
              <span>
                ChargeWise <b>SG</b>
              </span>
            </div>
            <span className="header-purpose">Find a charger</span>
            <div className="live-indicator">
              <span /> {providerLabel}
            </div>
          </div>
        </header>
        <ExplorePage notify={setToast} />
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
