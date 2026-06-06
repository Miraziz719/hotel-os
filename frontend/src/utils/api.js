const BASE = ''
const QUEUE_KEY = 'offline_queue'

export function getToken() {
  return localStorage.getItem('token')
}
export function getRole() {
  return localStorage.getItem('role')
}
export function getUser() {
  return {
    token:      localStorage.getItem('token'),
    role:       localStorage.getItem('role'),
    username:   localStorage.getItem('username'),
    roomNumber: localStorage.getItem('room_number'),
  }
}
export function saveAuth(data) {
  localStorage.setItem('token',       data.access_token)
  localStorage.setItem('role',        data.role)
  localStorage.setItem('username',    data.username || '')
  localStorage.setItem('room_number', data.room_number || '')
  window.dispatchEvent(new Event('auth-changed'))
}
export function clearAuth() {
  localStorage.clear()
  window.dispatchEvent(new Event('auth-changed'))
}

// ---------- Offline queue ----------

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [] } catch { return [] }
}
function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}
export function queueSize() {
  return readQueue().length
}

function enqueue(item) {
  const q = readQueue()
  q.push({ ...item, id: Date.now() + Math.random(), queued_at: new Date().toISOString() })
  writeQueue(q)
  window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { size: q.length } }))
}

let flushing = false

/**
 * Try to send all queued requests. Stops on first network failure
 * (keeps remaining items for the next attempt). Returns number sent.
 */
export async function flushQueue() {
  if (flushing) return 0
  flushing = true
  let sent = 0
  try {
    let q = readQueue()
    while (q.length) {
      const item = q[0]
      try {
        await rawRequest(item.url, { method: 'POST', body: JSON.stringify(item.body) })
      } catch (e) {
        if (e.isNetwork) break          // still offline → keep the queue, retry later
        // server rejected it (4xx/5xx) → drop it so it doesn't block forever
      }
      q = readQueue()
      q.shift()
      writeQueue(q)
      sent += 1
    }
  } finally {
    flushing = false
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: { size: queueSize() } }))
  }
  return sent
}

// ---------- Core request ----------

async function rawRequest(url, options = {}) {
  const token = getToken()
  let res
  try {
    res = await fetch(BASE + url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
  } catch (e) {
    // Network failure (server unreachable / offline)
    const err = new Error('Tarmoq bilan aloqa yo‘q')
    err.isNetwork = true
    throw err
  }

  const contentType = res.headers.get('content-type') || ''
  let data
  if (contentType.includes('application/json')) {
    data = await res.json()
  } else {
    const text = await res.text()
    data = { detail: text || 'Server xatosi' }
  }
  if (!res.ok) throw new Error(data.detail || 'Xato yuz berdi')
  return data
}

async function request(url, options = {}) {
  try {
    return await rawRequest(url, options)
  } catch (e) {
    // Queue write operations that fail because the network is down
    if (e.isNetwork && options.method === 'POST' && options._queueable) {
      enqueue({ url, body: JSON.parse(options.body || '{}') })
      return { _queued: true, message: 'Aloqa tiklanganda yuboriladi' }
    }
    throw e
  }
}

export const api = {
  // Mutations are queueable: if offline, they are stored and retried later.
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body), _queueable: true }),
  get:  (url)       => request(url),
}

// Flush whenever the browser regains connectivity.
window.addEventListener('online', () => { flushQueue() })
