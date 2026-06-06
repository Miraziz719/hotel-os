import { Navigate } from 'react-router-dom'
import { getUser } from '../utils/api'

const ROLE_HOME = {
  admin: '/admin', reception: '/reception', housekeeping: '/room-service',
  room_service: '/kitchen', maintenance: '/problems', guest: '/guest-kitchen',
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, role } = getUser()
  if (!token) return <Navigate to="/" replace />
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={ROLE_HOME[role] || '/'} replace />
  }
  return children
}
