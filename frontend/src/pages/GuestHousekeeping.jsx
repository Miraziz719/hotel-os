import HousekeepingWorkspace from '../components/HousekeepingWorkspace'
import NotCheckedIn from '../components/NotCheckedIn'
import { getUser } from '../utils/api'

export default function GuestHousekeeping() {
  const { roomNumber } = getUser()

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#f0fff4,#f0f8ff)' }}>
      <div className="max-w-5xl mx-auto p-6">
        {roomNumber ? <HousekeepingWorkspace isGuest /> : <NotCheckedIn />}
      </div>
    </div>
  )
}
