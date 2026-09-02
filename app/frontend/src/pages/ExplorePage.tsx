import { useCallback, useRef, useState } from 'react'
import { ActionIcon, Alert, Button, Loader, Paper, Select, Stack, Textarea, TextInput } from '@mantine/core'
import { AlertTriangle, Bot, CircleAlert, LocateFixed, MessageCircle, Search, Send, X } from 'lucide-react'
import { api } from '../api'
import { MapPanel } from '../components/MapPanel'
import { StationCard } from '../components/StationCard'
import { StationDetailsModal } from '../components/StationDetailsModal'
import type {
  ChatMessage,
  DrivingRoute,
  RankedStation,
  RecommendationResponse,
  RankingPriority,
  SearchMetadata,
} from '../types'

export function ExplorePage({ notify }: { notify: (message: string) => void }) {
  const [locationQuery, setLocationQuery] = useState('')
  const [priority, setPriority] = useState<RankingPriority>('Balanced')
  const [searchResult, setSearchResult] = useState<SearchMetadata | null>(null)
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState<RankedStation | null>(null)
  const [mapSelectedId, setMapSelectedId] = useState<string>()
  const [route, setRoute] = useState<DrivingRoute | null>(null)
  const [routeStationId, setRouteStationId] = useState<string>()
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeError, setRouteError] = useState('')
  const routeRequestId = useRef(0)
  const [searchCoords, setSearchCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number
    longitude: number
    accuracy: number
  } | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatStatus, setChatStatus] = useState('')
  const [chatError, setChatError] = useState('')

  const requestCurrentLocation = useCallback(
    () =>
      new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Current location is unavailable. Allow location access to show a route.'))
          return
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const nextLocation = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }
            setCurrentLocation(nextLocation)
            resolve(nextLocation)
          },
          () => reject(new Error('Allow location access to show a route from your current location.')),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
        )
      }),
    [],
  )

  const loadRoute = useCallback(
    async (station: RankedStation) => {
      const requestId = ++routeRequestId.current
      setRouteStationId(station.id)
      setRoute(null)
      setRouteError('')

      setRouteLoading(true)
      try {
        const origin = await requestCurrentLocation()
        const nextRoute = await api.getDrivingRoute(origin, station)
        if (requestId === routeRequestId.current) {
          setRoute(nextRoute)
          const routeMetrics = {
            distanceKm: nextRoute.distanceKm,
            travelMinutes: nextRoute.travelMinutes,
            travelSource: 'OneMap' as const,
          }
          setRecommendation((current) => {
            if (!current) return current
            const ranked = current.ranked.map((item) =>
              item.id === station.id ? { ...item, ...routeMetrics } : item,
            )
            return {
              ...current,
              ranked,
              recommended:
                current.recommended?.id === station.id
                  ? { ...current.recommended, ...routeMetrics }
                  : current.recommended,
            }
          })
          setDetails((current) => (current?.id === station.id ? { ...current, ...routeMetrics } : current))
        }
      } catch (reason) {
        if (requestId === routeRequestId.current) {
          setRouteError((reason as Error).message || 'OneMap could not return a road route.')
        }
      } finally {
        if (requestId === routeRequestId.current) setRouteLoading(false)
      }
    },
    [requestCurrentLocation],
  )

  const selectStation = useCallback((station: RankedStation, openDetails = true) => {
    routeRequestId.current += 1
    setMapSelectedId(station.id)
    if (openDetails) setDetails(station)
    setRoute(null)
    setRouteStationId(undefined)
    setRouteLoading(false)
    setRouteError('')
  }, [])

  const runSearch = async () => {
    if (!locationQuery.trim() && !searchCoords) {
      setError('Enter an address or postal code, or use your current location.')
      return
    }
    setLoading(true)
    setError('')
    routeRequestId.current += 1
    setRoute(null)
    setRouteStationId(undefined)
    setRouteLoading(false)
    setRouteError('')
    try {
      const ranked = await api.recommend({
        query: locationQuery || undefined,
        latitude: searchCoords?.latitude,
        longitude: searchCoords?.longitude,
        rankingPriority: priority,
      })
      setHasSearched(true)
      setSearchResult(ranked.search)
      setRecommendation(ranked)
      if (ranked.recommended) {
        setMapSelectedId(ranked.recommended.id)
      }
      notify(`${ranked.ranked.length} compatible station${ranked.ranked.length === 1 ? '' : 's'} found`)
    } catch (reason) {
      setError((reason as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const useMyLocation = () => {
    void requestCurrentLocation()
      .then((nextLocation) => {
        setSearchCoords({ latitude: nextLocation.latitude, longitude: nextLocation.longitude })
        setLocationQuery('My current location')
        notify(
          `Current location found (about ${Math.round(nextLocation.accuracy)} m accuracy) — press Search to refresh`,
        )
      })
      .catch((reason) => setError((reason as Error).message))
  }

  const sendChatMessage = async () => {
    const message = chatInput.trim()
    if (!message || chatLoading) return
    const conversation = chatMessages.slice(-12)
    setChatMessages((current) => [...current, { role: 'user', content: message }])
    setChatInput('')
    setChatError('')
    setChatLoading(true)
    setChatStatus('Understanding your request…')
    const statusTimer = window.setTimeout(() => setChatStatus('Finding compatible chargers…'), 700)
    try {
      const coordinates = searchCoords ?? currentLocation ?? undefined
      const result = await api.chat({
        message,
        conversation,
        context: {
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          selectedStationIds: mapSelectedId ? [mapSelectedId] : [],
        },
      })
      setChatMessages((current) => [...current, { role: 'assistant', content: result.reply }])
      if (result.recommendation) {
        routeRequestId.current += 1
        setRoute(null)
        setRouteStationId(undefined)
        setRouteError('')
        setHasSearched(true)
        setRecommendation(result.recommendation)
        setSearchResult(result.recommendation.search)
        setPriority(result.filters.rankingPriority)
        if (result.filters.query) {
          setLocationQuery(result.filters.query)
          setSearchCoords(null)
        }
        if (result.recommendation.recommended) {
          setMapSelectedId(result.recommendation.recommended.id)
        }
        notify(
          `${result.recommendation.ranked.length} compatible station${result.recommendation.ranked.length === 1 ? '' : 's'} found`,
        )
      }
    } catch (reason) {
      setChatError(
        (reason as Error).message ||
          'Ask ChargeWise is temporarily unavailable. Use the normal search instead.',
      )
    } finally {
      window.clearTimeout(statusTimer)
      setChatLoading(false)
      setChatStatus('')
    }
  }

  const ranked = recommendation?.ranked ?? []
  const routeStation = ranked.find((item) => item.id === routeStationId) ?? null
  const routeOrigin = currentLocation ?? undefined
  const selectMapStation = useCallback((id: string) => setMapSelectedId(id), [])
  return (
    <div className="page explore-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">INTELLIGENT CHARGER SEARCH</span>
          <h1>
            Find your best charge, <em>not just the nearest.</em>
          </h1>
          <p>
            Choose a location and what matters most. Chargers are scored on savings, speed and availability.
          </p>
        </div>
      </section>

      <Paper className="search-card" radius="lg" shadow="sm" withBorder>
        <div className="search-grid">
          <TextInput
            className="location-field"
            label="Where do you need to charge?"
            value={locationQuery}
            onChange={(event) => {
              setLocationQuery(event.currentTarget.value)
              setSearchCoords(null)
              setError('')
            }}
            placeholder="Address or postal code"
            leftSection={<Search size={18} />}
            rightSection={
              <ActionIcon variant="subtle" onClick={useMyLocation} aria-label="Use current location">
                <LocateFixed size={18} />
              </ActionIcon>
            }
          />
          <Select
            label="Ranking priority"
            value={priority}
            onChange={(value) => setPriority((value ?? 'Balanced') as RankingPriority)}
            data={['Balanced', 'Availability', 'Speed', 'Savings']}
            allowDeselect={false}
          />
          <Button
            className="search-button"
            onClick={() => void runSearch()}
            loading={loading}
            leftSection={<Search size={17} />}
          >
            Search
          </Button>
        </div>
      </Paper>

      <div className="ask-chargewise-row">
        <Button
          variant={chatOpen ? 'light' : 'default'}
          leftSection={<MessageCircle size={17} />}
          onClick={() => setChatOpen((open) => !open)}
        >
          Ask ChargeWise
        </Button>
        <span>Describe a charger, location, budget, or availability preference naturally.</span>
      </div>

      {chatOpen && (
        <Paper className="chat-panel" radius="lg" shadow="sm" withBorder>
          <div className="chat-header">
            <div>
              <span className="chat-bot-icon">
                <Bot size={18} />
              </span>
              <div>
                <b>Ask ChargeWise</b>
                <small>AI understands your request; live data and rankings come from ChargeWise.</small>
              </div>
            </div>
            <ActionIcon variant="subtle" onClick={() => setChatOpen(false)} aria-label="Close chatbot">
              <X size={17} />
            </ActionIcon>
          </div>
          <div className="chat-messages" aria-live="polite">
            {chatMessages.length === 0 && (
              <div className="chat-welcome">
                Try “Find a fast CCS2 charger near Orchard under S$0.60/kWh.”
              </div>
            )}
            {chatMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                {message.content}
              </div>
            ))}
            {chatLoading && (
              <div className="chat-thinking">
                <Loader size="xs" /> {chatStatus}
              </div>
            )}
          </div>
          {chatError && (
            <Alert className="chat-error" color="red" icon={<CircleAlert size={16} />}>
              {chatError} The normal search above is still available.
            </Alert>
          )}
          <div className="chat-compose">
            <Textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendChatMessage()
                }
              }}
              placeholder="What kind of charger do you need?"
              autosize
              minRows={1}
              maxRows={3}
              aria-label="Message Ask ChargeWise"
            />
            <ActionIcon
              size="lg"
              color="green"
              onClick={() => void sendChatMessage()}
              disabled={!chatInput.trim() || chatLoading}
              aria-label="Send message"
            >
              <Send size={17} />
            </ActionIcon>
          </div>
          <small className="chat-disclaimer">
            Do not share sensitive information. Use the explicit controls for monitoring actions.
          </small>
        </Paper>
      )}

      {error && (
        <Alert className="error-banner" color="red" icon={<CircleAlert size={18} />}>
          {error}
        </Alert>
      )}
      {searchResult?.dataStatus.isCached && (
        <Alert className="cache-banner" color="yellow" icon={<AlertTriangle size={16} />}>
          <span>
            <b>Using the latest cached LTA snapshot</b> · Updated{' '}
            {new Date(searchResult.dataStatus.lastUpdated).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
            . {searchResult.dataStatus.fallbackReason || 'Live availability is never guaranteed.'}
          </span>
        </Alert>
      )}

      {loading && ranked.length === 0 ? (
        <div className="page-loading">
          <Loader size="md" />
          <h3>Ranking compatible chargers…</h3>
          <p>Scoring savings, speed and availability. Equal scores are ordered by distance.</p>
        </div>
      ) : ranked.length > 0 ? (
        <>
          <div className="results-heading">
            <div>
              <h2>
                {searchResult && searchResult.totalMatches > ranked.length
                  ? `Top ${ranked.length} of ${searchResult.totalMatches}`
                  : ranked.length}{' '}
                compatible options
              </h2>
              <p>
                Near {searchResult?.location.label} · {priority.toLowerCase()} priority
              </p>
            </div>
            <span className="result-updated">
              <i /> Data checked just now
            </span>
          </div>
          <div className="results-layout">
            <Stack className="station-list" gap={12}>
              {ranked.map((station, index) => (
                <StationCard
                  key={station.id}
                  station={station}
                  rank={index + 1}
                  best={index === 0}
                  onDetails={selectStation}
                  onHover={selectMapStation}
                />
              ))}
            </Stack>
            <aside className="map-column">
              <MapPanel
                stations={ranked}
                selectedId={mapSelectedId}
                onSelect={selectStation}
                location={searchResult!.location}
                currentLocation={currentLocation ?? undefined}
                routeOrigin={routeOrigin}
                route={route}
                routeStation={routeStation}
                routeLoading={routeLoading}
                routeError={routeError}
              />
              <Paper className="map-disclaimer" radius="md">
                <CircleAlert size={15} /> Availability is a snapshot, not a reservation.
              </Paper>
            </aside>
          </div>
        </>
      ) : hasSearched ? (
        <div className="empty-state">
          <Search size={34} />
          <h2>No compatible stations found</h2>
          <p>Try a different address or postal code.</p>
        </div>
      ) : (
        <div className="empty-state">
          <LocateFixed size={34} />
          <h2>Choose where you want to charge</h2>
          <p>Enter a Singapore address or postal code, or use your current location to begin.</p>
        </div>
      )}

      {details && (
        <StationDetailsModal
          station={details}
          onClose={() => setDetails(null)}
          onShowRoute={() => void loadRoute(details)}
          routeVisible={routeStationId === details.id && route !== null}
          routeLoading={routeStationId === details.id && routeLoading}
          routeError={routeStationId === details.id ? routeError : ''}
        />
      )}
    </div>
  )
}
