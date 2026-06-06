import MaintenanceWorkspace from '../components/MaintenanceWorkspace'
import NotCheckedIn from '../components/NotCheckedIn'
import { getUser } from '../utils/api'

export default function GuestMaintenance() {
  const { roomNumber } = getUser()

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#f0fff4,#f0f8ff)' }}>
      <div className="max-w-5xl mx-auto p-6">
        {roomNumber ? <MaintenanceWorkspace isGuest /> : <NotCheckedIn />}
      </div>
    </div>
  )
}
