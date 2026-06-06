import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button, Tooltip } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { clearAuth, getUser, queueSize } from '../utils/api'
import { useWSStatus } from '../hooks/WSContext'

const ALL_PAGES = [
  { path: '/admin',        label: 'Dashboard',    roles: ['admin'],                                          bg: '#1a1f2e' },
  { path: '/reception',    label: 'Reception',    roles: ['admin', 'reception'],                             bg: '#2d5be3' },
  { path: '/room-service', label: 'Room Service', roles: ['admin', 'reception', 'housekeeping'],             bg: '#1a7a4a' },
  { path: '/kitchen',      label: 'Kitchen',      roles: ['admin', 'reception', 'room_service'],             bg: '#c05621' },
  { path: '/problems',     label: 'Problems',     roles: ['admin', 'reception', 'maintenance'],              bg: '#7b2fa8' },
  { path: '/guest-kitchen',      label: 'Kitchen',      roles: ['guest'], bg: '#c05621' },
  { path: '/guest-room-service', label: 'Room Service', roles: ['guest'], bg: '#1a7a4a' },
  { path: '/guest-problems',     label: 'Problems',     roles: ['guest'], bg: '#7b2fa8' },
]

export default function NavBar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { role, username, roomNumber } = getUser()
  const live = useWSStatus()
  const [pending, setPending] = useState(queueSize())

  useEffect(() => {
    const onChange = e => setPending(e.detail?.size ?? queueSize())
    window.addEventListener('offline-queue-changed', onChange)
    return () => window.removeEventListener('offline-queue-changed', onChange)
  }, [])

  if (!role) return null

  const activePage = ALL_PAGES.find(p => location.pathname === p.path || location.pathname.startsWith(`${p.path}/`))
  const bg = activePage?.bg || '#1a1f2e'
  const pages = ALL_PAGES.filter(p => p.roles.includes(role))

  function handleLogout() {
    clearAuth()
    navigate('/')
  }

  return (
    <header
      className="sticky top-0 z-50 shadow-md"
      style={{ background: bg }}
    >
      {/* Main row */}
      <div
        className={`flex items-center px-3 sm:px-5 ${['guest','housekeeping','room_service','maintenance'].includes(role) ? 'max-w-5xl mx-auto w-full' : ''}`}
        style={{ height: 52 }}
      >
        {/* Logo */}
        <span className="text-white font-extrabold text-base sm:text-lg tracking-tight flex-shrink-0 mr-3 sm:mr-5">
          HotelOS
        </span>

        {/* Nav links — scrollable on mobile */}
        <nav
          className="flex h-full flex-1 overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {pages.map(p => {
            const active = location.pathname === p.path || location.pathname.startsWith(`${p.path}/`)
            return (
              <button
                key={p.path}
                onClick={() => navigate(p.path)}
                className="flex-shrink-0 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all cursor-pointer bg-transparent"
                style={{
                  color:        active ? '#fff' : 'rgba(255,255,255,0.58)',
                  borderBottom: active ? '3px solid #fff' : '3px solid transparent',
                  borderTop:    'none',
                  borderLeft:   'none',
                  borderRight:  'none',
                  height:       '100%',
                  whiteSpace:   'nowrap',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {/* Connection status indicator — single dot */}
          <Tooltip title={
            live
              ? (pending > 0 ? `Ulangan — ${pending} ta ish yuborilmoqda` : 'Jonli ulangan')
              : (pending > 0 ? `Oflayn — ${pending} ta ish navbatda` : 'Oflayn')
          }>
            <span className="flex items-center gap-1 flex-shrink-0">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{
                  background: live ? '#4ade80' : '#f87171',
                  boxShadow: live ? '0 0 6px #4ade80' : 'none',
                }}
              />
              {pending > 0 && (
                <span className="text-xs font-semibold" style={{ color: '#fff' }}>{pending}</span>
              )}
            </span>
          </Tooltip>

          {/* Username + room (guest) — hidden on very small screens */}
          <span
            className="hidden sm:flex items-center gap-1.5 text-xs"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <span className="flex flex-col leading-tight">
              <span className="max-w-28 truncate">{username}</span>
              {role === 'guest' && roomNumber && (
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                  Xona {roomNumber}
                </span>
              )}
            </span>
          </span>

          {/* Logout — icon only on mobile, text+icon on desktop */}
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
