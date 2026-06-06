import { useEffect, useState } from 'react'
import { Button, Spin, Alert } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import RoomServiceMenu from '../components/RoomServiceMenu'
import { api } from '../utils/api'

export default function RoomServiceNewOrder() {
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadRooms() {
      try {
        setError('')
        const data = await api.get('/reception/occupied-rooms')
        if (!active) return
        setRooms(
          data
            .map(room => ({
              value: room.room_number,
              label: `Xona ${room.room_number} - ${room.room_type}`,
            })),
        )
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadRooms()
    return () => { active = false }
  }, [])

  return (
    <div className="p-6" style={{ background:'#fff8f0', minHeight:'calc(100vh - 52px)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/room-service')}>
            Orqaga
          </Button>
        </div>

        {error && <Alert type="error" message={error} showIcon className="mb-4" />}

        {loading
          ? <div className="py-16 text-center"><Spin size="large" /></div>
          : (
            <RoomServiceMenu
              allowRoomSelection
              roomOptions={rooms}
              title="Yangi buyurtma"
              successText="Yangi buyurtma muvaffaqiyatli yaratildi."
              onOrderPlaced={() => navigate('/room-service')}
            />
          )}
      </div>
    </div>
  )
}
