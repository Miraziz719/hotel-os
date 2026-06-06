import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Tooltip } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { clearAuth, getUser, queueSize } from '../utils/api'
import { useServiceStatuses } from '../hooks/ServiceStatusContext'
import { useWSStatus } from '../hooks/WSContext'

const ALL_PAGES = [
  { path: '/admin', label: 'Dashboard', roles: ['admin'], bg: '#1a1f2e' },
  { path: '/reception', label: 'Reception', roles: ['admin', 'reception'], bg: '#2d5be3' },
  { path: '/room-service', label: 'Room Service', roles: ['admin', 'reception', 'housekeeping'], bg: '#1a7a4a' },
  { path: '/kitchen', label: 'Kitchen', roles: ['admin', 'reception', 'room_service'], bg: '#c05621' },
  { path: '/problems', label: 'Problems', roles: ['admin', 'reception', 'maintenance'], bg: '#7b2fa8' },
  { path: '/guest-kitchen', label: 'Kitchen', roles: ['guest'], bg: '#c05621' },
  { path: '/guest-room-service', label: 'Room Service', roles: ['guest'], bg: '#1a7a4a' },
  { path: '/guest-problems', label: 'Problems', roles: ['guest'], bg: '#7b2fa8' },
]

const SERVICE_BADGES = [
  { key: 'reception', short: 'RC' },
  { key: 'housekeeping', short: 'HK' },
  { key: 'room_service', short: 'RS' },
  { key: 'maintenance', short: 'MT' },
]

export default function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, username, roomNumber } = getUser()
  const live = useWSStatus()
  const services = useServiceStatuses()
  const [pending, setPending] = useState(queueSize())

  useEffect(() => {
    const onChange = event => setPending(event.detail?.size ?? queueSize())
    window.addEventListener('offline-queue-changed', onChange)
    return () => window.removeEventListener('offline-queue-changed', onChange)
  }, [])

  if (!role) return null

  const activePage = ALL_PAGES.find(page => location.pathname === page.path || location.pathname.startsWith(`${page.path}/`))
  const bg = activePage?.bg || '#1a1f2e'
  const pages = ALL_PAGES.filter(page => page.roles.includes(role))

  function handleLogout() {
    clearAuth()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 shadow-md" style={{ background: bg }}>
      <div
        className={`flex items-center px-3 sm:px-5 ${['guest', 'housekeeping', 'room_service', 'maintenance'].includes(role) ? 'max-w-5xl mx-auto w-full' : ''}`}
        style={{ height: 52 }}
      >
        <span className="text-white font-extrabold text-base sm:text-lg tracking-tight flex-shrink-0 mr-3 sm:mr-5">
          HotelOS
        </span>

        <nav className="flex h-full flex-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {pages.map(page => {
            const active = location.pathname === page.path || location.pathname.startsWith(`${page.path}/`)
            return (
              <button
                key={page.path}
                onClick={() => navigate(page.path)}
                className="flex-shrink-0 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all cursor-pointer bg-transparent"
                style={{
                  color: active ? '#fff' : 'rgba(255,255,255,0.58)',
                  borderBottom: active ? '3px solid #fff' : '3px solid transparent',
                  borderTop: 'none',
                  borderLeft: 'none',
                  borderRight: 'none',
                  height: '100%',
                  whiteSpace: 'nowrap',
                }}
              >
                {page.label}
              </button>
            )
          })}
        </nav>

        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <Tooltip title={live ? (pending > 0 ? `Ulangan - ${pending} ta ish yuborilmoqda` : 'Jonli ulangan') : (pending > 0 ? `Oflayn - ${pending} ta ish navbatda` : 'Oflayn')}>
            <span className="flex items-center gap-1 flex-shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{
                  background: live ? '#4ade80' : '#f87171',
                  boxShadow: live ? '0 0 6px #4ade80' : 'none',
                }}
              />
              {pending > 0 && <span className="text-xs font-semibold" style={{ color: '#fff' }}>{pending}</span>}
            </span>
          </Tooltip>

          <div className="hidden md:flex items-center gap-1.5">
            {SERVICE_BADGES.map(service => {
              const current = services[service.key]
              const online = current?.online
              const color = online == null ? '#94a3b8' : (online ? '#4ade80' : '#f87171')
              return (
                <Tooltip
                  key={service.key}
                  title={`${current?.label || service.key}: ${online == null ? 'tekshirilmoqda' : online ? 'ishlayapti' : 'ishlamayapti'}`}
                >
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ color: '#fff', background: color, minWidth: 24, textAlign: 'center' }}
                  >
                    {service.short}
                  </span>
                </Tooltip>
              )
            })}
          </div>

          <span className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <span className="flex flex-col leading-tight">
              <span className="max-w-28 truncate">{username}</span>
              {role === 'guest' && roomNumber && (
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                  Xona {roomNumber}
                </span>
              )}
            </span>
          </span>

          <Button
            size="small"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', flexShrink: 0 }}
          >
            <span className="hidden sm:inline">Chiqish</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
