import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { flushQueue, getRealtimeSocketUrl, getToken } from '../utils/api'

const WSContext = createContext({ live: false, register: () => () => {} })

export function useWSStatus() {
  return useContext(WSContext).live
}

const registry = {}

function register(event, cb) {
  if (!registry[event]) registry[event] = new Set()
  registry[event].add(cb)
  return () => registry[event].delete(cb)
}

export function WSProvider({ children }) {
  const [live, setLive] = useState(false)
  const wsRef = useRef(null)

  useEffect(() => {
    let alive = true
    let timer = null

    function connect() {
      if (!alive) return
      const token = getToken()
      if (!token) {
        timer = setTimeout(connect, 3000)
        return
      }
      if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return

      const ws = new WebSocket(getRealtimeSocketUrl(token))
      wsRef.current = ws

      ws.onopen = async () => {
        setLive(true)
        await flushQueue()
        registry._onConnect?.forEach(cb => cb())
      }

      ws.onmessage = event => {
        if (event.data === 'pong') return
        try {
          const msg = JSON.parse(event.data)
          registry[msg.event]?.forEach(cb => cb(msg.data))
        } catch {}
      }

      ws.onclose = () => {
        setLive(false)
        if (!alive) return
        timer = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    function onAuthChange() {
      try { wsRef.current?.close() } catch {}
      wsRef.current = null
      setLive(false)
      clearTimeout(timer)
      connect()
    }

    window.addEventListener('auth-changed', onAuthChange)
    connect()

    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send('ping')
    }, 25000)

    return () => {
      alive = false
      clearTimeout(timer)
      clearInterval(ping)
      window.removeEventListener('auth-changed', onAuthChange)
      wsRef.current?.close()
    }
  }, [])

  return <WSContext.Provider value={{ live, register }}>{children}</WSContext.Provider>
}

export function useWSEvents(handlers) {
  const { live, register } = useContext(WSContext)
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const cleanups = Object.entries(handlersRef.current).map(([event, cb]) =>
      register(event, (...args) => handlersRef.current[event]?.(...args))
    )
    return () => cleanups.forEach(fn => fn())
  }, [register])

  return { live }
}
