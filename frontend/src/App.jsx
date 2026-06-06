import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import NavBar         from './components/NavBar'
import ProtectedRoute from './components/ProtectedRoute'
import Login          from './pages/Login'
import Admin          from './pages/Admin'
import Reception      from './pages/Reception'
import Housekeeping   from './pages/Housekeeping'
import RoomService    from './pages/RoomService'
import Maintenance    from './pages/Maintenance'
import Guest          from './pages/Guest'
import GuestRoomService from './pages/GuestRoomService'
import GuestMyOrders from './pages/GuestMyOrders'
import GuestHousekeeping from './pages/GuestHousekeeping'
import GuestMaintenance from './pages/GuestMaintenance'
import { getUser }   from './utils/api'
import { WSProvider } from './hooks/WSContext'
import GuestCheckoutWatcher from './components/GuestCheckoutWatcher'

const ROLE_HOME = {
  admin:'admin', reception:'reception', housekeeping:'room-service',
  room_service:'kitchen', maintenance:'problems', guest:'guest-kitchen',
}

function RedirectHome() {
  const { token, role } = getUser()
  if (!token) return <Navigate to="/" replace />
  return <Navigate to={`/${ROLE_HOME[role] || ''}`} replace />
}

function OverlayCleanup() {
  const location = useLocation()

  useEffect(() => {
    document.body.classList.remove('ant-scrolling-effect')
    document.body.style.overflow = ''
    document.body.style.pointerEvents = ''

    document.querySelectorAll(
      '.ant-modal-root, .ant-modal-mask, .ant-modal-wrap, .ant-drawer-root, .ant-drawer-mask, .ant-drawer-content-wrapper',
    ).forEach(node => node.remove())
  }, [location.pathname])

  return null
}

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#2d5be3', borderRadius: 8 } }}>
      <WSProvider>
      <BrowserRouter>
        <OverlayCleanup />
        <GuestCheckoutWatcher />
        <NavBar />
        <Routes>
          <Route path="/"             element={<Login />} />
          <Route path="/home"         element={<RedirectHome />} />

          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['admin']}><Admin /></ProtectedRoute>} />

          <Route path="/reception" element={
            <ProtectedRoute allowedRoles={['admin','reception']}><Reception /></ProtectedRoute>} />

          <Route path="/room-service" element={
            <ProtectedRoute allowedRoles={['admin','reception','housekeeping']}><Housekeeping /></ProtectedRoute>} />

          <Route path="/kitchen" element={
            <ProtectedRoute allowedRoles={['admin','reception','room_service']}><RoomService /></ProtectedRoute>} />

          <Route path="/problems" element={
            <ProtectedRoute allowedRoles={['admin','reception','maintenance']}><Maintenance /></ProtectedRoute>} />

          <Route path="/guest" element={
            <ProtectedRoute allowedRoles={['guest']}><Guest /></ProtectedRoute>} />

          <Route path="/guest-kitchen" element={
            <ProtectedRoute allowedRoles={['guest']}><GuestRoomService /></ProtectedRoute>} />

          <Route path="/guest-my-orders" element={
            <ProtectedRoute allowedRoles={['guest']}><GuestMyOrders /></ProtectedRoute>} />

          <Route path="/guest-room-service" element={
            <ProtectedRoute allowedRoles={['guest']}><GuestHousekeeping /></ProtectedRoute>} />

          <Route path="/guest-problems" element={
            <ProtectedRoute allowedRoles={['guest']}><GuestMaintenance /></ProtectedRoute>} />

          <Route path="*" element={<RedirectHome />} />
        </Routes>
      </BrowserRouter>
      </WSProvider>
    </ConfigProvider>
  )
}
