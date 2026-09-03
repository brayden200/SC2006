import { useEffect, useRef, useState } from 'react'
import { Alert, Loader, Paper, Textarea } from '@mantine/core'
import { Bot, CircleAlert, MessageCircle, Send, X } from 'lucide-react'
import type { ChatMessage } from '../types'

const MOBILE_QUERY = '(max-width: 620px)'
const WELCOME_MESSAGE = 'Hi! Need help finding a charger? Tell me where you’re going and what matters most.'

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => {
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

export interface ChatWidgetProps {
  open: boolean
  onOpen: () => void
  onClose: () => void
  messages: ChatMessage[]
  draft: string
  onDraftChange: (value: string) => void
  loading: boolean
  status: string
  error: string
  onSend: () => void | Promise<void>
}

export function ChatWidget({
  open,
  onOpen,
  onClose,
  messages,
  draft,
  onDraftChange,
  loading,
  status,
  error,
  onSend,
}: ChatWidgetProps) {
  const [welcomeVisible, setWelcomeVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const chatWindowRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)
  const welcomeTimerRef = useRef<number | null>(null)
  const wasNearBottomRef = useRef(true)
  const wasOpenRef = useRef(false)
  const previousMessageCountRef = useRef(messages.length)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_QUERY)
    const update = () => setIsMobile(mediaQuery.matches)
    update()
    mediaQuery.addEventListener?.('change', update)
    return () => mediaQuery.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    welcomeTimerRef.current = window.setTimeout(() => {
      setWelcomeVisible(true)
      welcomeTimerRef.current = null
    }, 1000)

    return () => {
      if (welcomeTimerRef.current !== null) {
        window.clearTimeout(welcomeTimerRef.current)
        welcomeTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        const frame = window.requestAnimationFrame(() => launcherRef.current?.focus())
        wasOpenRef.current = false
        return () => window.cancelAnimationFrame(frame)
      }
      return
    }

    setWelcomeVisible(false)
    if (welcomeTimerRef.current !== null) {
      window.clearTimeout(welcomeTimerRef.current)
      welcomeTimerRef.current = null
    }
    wasOpenRef.current = true
    wasNearBottomRef.current = true
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (previousMessageCountRef.current < messages.length) {
      const latestMessage = messages.at(-1)
      if (latestMessage?.role === 'assistant') {
        setAnnouncement(`ChargeWise replied: ${latestMessage.content}`)
      }
    }
    previousMessageCountRef.current = messages.length
  }, [messages])

  useEffect(() => {
    if (!open) return
    const messageArea = messagesRef.current
    if (!messageArea || !wasNearBottomRef.current) return
    const frame = window.requestAnimationFrame(() => {
      messageEndRef.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'end',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages.length, loading, status, open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (!isMobile || event.key !== 'Tab') return

      const chatWindow = chatWindowRef.current
      if (!chatWindow) return
      const focusable = getFocusableElements(chatWindow)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable.at(-1)
      if (
        event.shiftKey &&
        (document.activeElement === first || !chatWindow.contains(document.activeElement))
      ) {
        event.preventDefault()
        last?.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !chatWindow.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMobile, onClose, open])

  const handleMessageScroll = () => {
    const messageArea = messagesRef.current
    if (!messageArea) return
    const distanceFromBottom = messageArea.scrollHeight - messageArea.scrollTop - messageArea.clientHeight
    wasNearBottomRef.current = distanceFromBottom < 56
  }

  const handleLauncherClick = () => {
    if (open) {
      onClose()
      return
    }
    setWelcomeVisible(false)
    onOpen()
  }

  return (
    <div className="chat-widget">
      {open && isMobile && <div className="chat-backdrop" aria-hidden="true" onClick={onClose} />}

      {welcomeVisible && !open && (
        <div className="chat-welcome-bubble" aria-label="Chat invitation">
          <button className="chat-welcome-message" type="button" onClick={handleLauncherClick}>
            {WELCOME_MESSAGE}
          </button>
        </div>
      )}

      <button
        ref={launcherRef}
        className="chat-launcher"
        type="button"
        onClick={handleLauncherClick}
        aria-label={open ? 'Close Ask ChargeWise' : 'Open Ask ChargeWise'}
        aria-expanded={open}
        aria-controls="chargewise-chat-window"
        title={open ? 'Close Ask ChargeWise' : 'Open Ask ChargeWise'}
      >
        {open ? <X size={25} strokeWidth={2.2} /> : <MessageCircle size={25} strokeWidth={2.2} />}
      </button>

      {open && (
        <Paper
          ref={chatWindowRef}
          id="chargewise-chat-window"
          className="chat-window"
          radius="lg"
          shadow="sm"
          withBorder
          role="dialog"
          aria-modal={isMobile ? true : undefined}
          aria-labelledby="chargewise-chat-title"
          aria-describedby="chargewise-chat-description"
          aria-busy={loading}
        >
          <div className="chat-header">
            <div>
              <span className="chat-bot-icon" aria-hidden="true">
                <Bot size={18} />
              </span>
              <div>
                <b id="chargewise-chat-title">Ask ChargeWise</b>
                <small id="chargewise-chat-description">
                  AI understands your request; live data and rankings come from ChargeWise.
                </small>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              className="chat-icon-button"
              type="button"
              onClick={onClose}
              aria-label="Close chatbot"
            >
              <X size={18} />
            </button>
          </div>

          <div
            ref={messagesRef}
            className="chat-messages"
            tabIndex={0}
            aria-label="Chat message history"
            aria-busy={loading}
            onScroll={handleMessageScroll}
          >
            {messages.length === 0 && (
              <div className="chat-welcome">
                Try “Find a fast CCS2 charger near Orchard under S$0.60/kWh.”
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
                {message.content}
              </div>
            ))}
            {loading && (
              <div className="chat-thinking" role="status" aria-live="polite">
                <Loader size="xs" /> {status || 'Understanding your request…'}
              </div>
            )}
            <div ref={messageEndRef} aria-hidden="true" />
          </div>

          {error && (
            <Alert className="chat-error" color="red" icon={<CircleAlert size={16} />} role="alert">
              {error} The main charger search remains available.
            </Alert>
          )}

          <form
            className="chat-compose"
            onSubmit={(event) => {
              event.preventDefault()
              void onSend()
            }}
          >
            <Textarea
              value={draft}
              onChange={(event) => onDraftChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  void onSend()
                }
              }}
              placeholder="What kind of charger do you need?"
              autosize
              minRows={1}
              maxRows={3}
              aria-label="Message Ask ChargeWise"
            />
            <button
              className="chat-send-button"
              type="submit"
              disabled={!draft.trim() || loading}
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
          <small className="chat-disclaimer">
            Do not share sensitive information. Use the explicit controls for monitoring actions.
          </small>
        </Paper>
      )}

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  )
}
