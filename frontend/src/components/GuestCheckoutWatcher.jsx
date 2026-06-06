import { useNavigate } from 'react-router-dom'
import { Modal, notification } from 'antd'
import { getUser, clearAuth, saveAuth, api } from '../utils/api'
import { useWSEvents } from '../hooks/WSContext'
import { playNotificationSound } from '../hooks/useWebSocket'

/**
 * Always mounted. Handles the guest's own session changes in real time:
 *  - checkout  → farewell message + logout
 *  - check-in (while already logged in without a room) → refresh token + unlock services
 */
export default function GuestCheckoutWatcher() {
  const navigate = useNavigate()

  useWSEvents({
    guest_checked_out: (data) => {
      const { role, roomNumber } = getUser()
      if (role !== 'guest') return
      if (String(data.room_number) !== String(roomNumber)) return

      playNotificationSound()
      Modal.destroyAll()
      Modal.success({
        title: 'Rahmat, yana kutamiz! 👋',
        content: 'Siz check-out qildingiz. Bizni tanlaganingiz uchun rahmat — sizni yana kutib qolamiz!',
        okText: 'Chiqish',
        keyboard: false,
        maskClosable: false,
        onOk: () => { clearAuth(); navigate('/') },
      })
    },

    guest_checked_in: async () => {
      const { role, roomNumber } = getUser()
      // Only relevant for a logged-in guest who is not yet checked in.
      if (role !== 'guest' || roomNumber) return
      try {
        const fresh = await api.post('/auth/refresh', {})
        if (fresh.room_number) {
          saveAuth(fresh)   // now has room_number → services unlocked
          playNotificationSound()
          notification.success({
            message: 'Check-in tasdiqlandi!',
            description: `Xush kelibsiz! Sizning xonangiz: ${fresh.room_number}. Endi xizmatlardan foydalanishingiz mumkin.`,
            placement: 'topRight',
            duration: 6,
          })
          setTimeout(() => window.location.reload(), 800)
        }
      } catch {}
    },
  })

  return null
}
