const QUEUE_KEY = 'offline_queue'

const SERVICE_META = {
  reception: {
    label: 'Reception',
    base: (import.meta.env.VITE_RECEPTION_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/$/, ''),
  },
  housekeeping: {
    label: 'Housekeeping',
    base: (import.meta.env.VITE_HOUSEKEEPING_SERVICE_URL || 'http://127.0.0.1:8002').replace(/\/$/, ''),
  },
  room_service: {
    label: 'Room Service',
    base: (import.meta.env.VITE_ROOM_SERVICE_URL || 'http://127.0.0.1:8003').replace(/\/$/, ''),
  },
  maintenance: {
    label: 'Maintenance',
    base: (import.meta.env.VITE_MAINTENANCE_SERVICE_URL || 'http://127.0.0.1:8004').replace(/\/$/, ''),
  },
}

const PREFIX_TO_SERVICE = {
  auth: 'reception',
  upload: 'reception',
  dashboard: 'reception',
  reception: 'reception',
  housekeeping: 'housekeeping',
  'room-service': 'room_service',
  maintenance: 'maintenance',
}

function emitServiceHealth(serviceKey, online, detail = '') {
  window.dispatchEvent(new CustomEvent('service-health-changed', {
    detail: {
      serviceKey,
      online,
      detail,
      checkedAt: new Date().toISOString(),
    },
  }))
}

function getServiceForUrl(url) {
  const trimmed = String(url || '').replace(/^\/+/, '')
  const prefix = trimmed.split('/')[0]
  const serviceKey = PREFIX_TO_SERVICE[prefix] || 'reception'
  return {
    serviceKey,
    serviceName: SERVICE_META[serviceKey].label,
    base: SERVICE_META[serviceKey].base,
  }
}

export function listServices() {
  return Object.entries(SERVICE_META).map(([key, value]) => ({ key, ...value }))
}

export function getServiceBase(serviceKey) {
  return SERVICE_META[serviceKey]?.base || SERVICE_META.reception.base
}

export function buildAbsoluteUrl(url) {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  const { base } = getServiceForUrl(url)
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}

export function getRealtimeSocketUrl(token) {
  const base = getServiceBase('reception')
  const wsBase = base.replace(/^http/i, protocol => protocol.toLowerCase() === 'https' ? 'wss' : 'ws')
  return `${wsBase}/dashboard/ws?token=${encodeURIComponent(token)}`
}

export async function checkServiceHealth(serviceKey) {
  const service = SERVICE_META[serviceKey]
  if (!service) return false
  try {
    const res = await fetch(`${service.base}/health`)
    const ok = res.ok
    emitServiceHealth(serviceKey, ok, ok ? 'ok' : `HTTP ${res.status}`)
    return ok
  } catch {
    emitServiceHealth(serviceKey, false, 'unreachable')
    return false
  }
}

export function getToken() {
  return localStorage.getItem('token')
}
export function getRole() {
  return localStorage.getItem('role')
}
export function getUser() {
  return {
    token: localStorage.getItem('token'),
    role: localStorage.getItem('role'),
    username: localStorage.getItem('username'),
    roomNumber: localStorage.getItem('room_number'),
  }
}
export function saveAuth(data) {
  localStorage.setItem('token', data.access_token)
  localStorage.setItem('role', data.role)
  localStorage.setItem('username', data.username || '')
  localStorage.setItem('room_number', data.room_number || '')
  window.dispatchEvent(new Event('auth-changed'))
}
export function clearAuth() {
  localStorage.clear()
  window.dispatchEvent(new Event('auth-changed'))
}

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
        if (e.isNetwork) break
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

async function rawRequest(url, options = {}) {
  const token = getToken()
  const { serviceKey, serviceName, base } = getServiceForUrl(url)
  let res
  try {
    res = await fetch(`${base}${url}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
    emitServiceHealth(serviceKey, true, 'ok')
  } catch {
    emitServiceHealth(serviceKey, false, 'unreachable')
    const err = new Error(`${serviceName} servisi bilan aloqa yo'q`)
    err.isNetwork = true
    err.serviceKey = serviceKey
    err.serviceName = serviceName
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
  if (!res.ok) {
    emitServiceHealth(serviceKey, false, `HTTP ${res.status}`)
    const err = new Error(data.detail || 'Xato yuz berdi')
    err.serviceKey = serviceKey
    err.serviceName = serviceName
    throw err
  }
  emitServiceHealth(serviceKey, true, 'ok')
  return data
}

async function request(url, options = {}) {
  try {
    return await rawRequest(url, options)
  } catch (e) {
    if (e.isNetwork && options.method === 'POST' && options._queueable) {
      enqueue({ url, body: JSON.parse(options.body || '{}') })
      return { _queued: true, message: 'Aloqa tiklanganda yuboriladi' }
    }
    throw e
  }
}

export async function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  return rawRequest('/upload', {
    method: 'POST',
    body: form,
    headers: {},
  })
}

export const api = {
  post: (url, body) => request(url, { method: 'POST', body: JSON.stringify(body), _queueable: true }),
  get: url => request(url),
}

window.addEventListener('online', () => { flushQueue() })
