import { useEffect, useState } from 'react'
import { Card, Table, Tag, Row, Col, Statistic, Space, Alert, Tooltip } from 'antd'
import {
  HomeOutlined, ShoppingCartOutlined, ToolOutlined, TeamOutlined,
} from '@ant-design/icons'
import { api } from '../utils/api'
import { useServiceStatuses } from '../hooks/ServiceStatusContext'
import { useWSEvents } from '../hooks/WSContext'

const WS_EVENTS = [
  'connected',
  'dashboard_update', 'room_status_changed', 'guest_checked_in', 'guest_checked_out',
  'order_created', 'order_status_changed', 'issue_created', 'issue_resolved', 'housekeeping_requested',
]

const STATUS_BG = {
  clean: '#f6ffed', dirty: '#fffbe6', occupied: '#fff1f0', cleaning: '#e6f4ff', maintenance: '#f3f4f6',
}
const STATUS_TEXT_COLOR = {
  clean: '#52c41a', dirty: '#fa8c16', occupied: '#ff4d4f', cleaning: '#1677ff', maintenance: '#6b7280',
}
const STATUS_LABEL = {
  clean: 'Toza',
  occupied: 'Band',
  dirty: 'Tozalash kerak',
  cleaning: 'Tozalanmoqda',
  maintenance: 'Tuzatishda',
}
const STATUS_EMOJI = {
  clean: '✅',
  occupied: '🛏️',
  dirty: '🧹',
  cleaning: '🫧',
  maintenance: '🔧',
}

export default function Admin() {
  const [rooms, setRooms] = useState([])
  const [orders, setOrders] = useState([])
  const [issues, setIssues] = useState([])
  const [bookings, setBookings] = useState([])
  const [events, setEvents] = useState([])
  const [warning, setWarning] = useState('')
  const services = useServiceStatuses()
  const occupiedRoomNumbers = new Set(bookings.map(booking => String(booking.room_id)))

  function appendEvent(eventName, data, publishedAt = null) {
    setEvents(prev => [
      {
        id: `${publishedAt || Date.now()}-${Math.random()}`,
        time: publishedAt ? new Date(publishedAt).toLocaleTimeString() : new Date().toLocaleTimeString(),
        event: eventName,
        data,
      },
      ...prev,
    ].slice(0, 30))
  }

  async function loadSnapshot() {
    const [roomsRes, bookingsRes, ordersRes, issuesRes, recentEventsRes] = await Promise.allSettled([
      api.get('/reception/rooms'),
      api.get('/reception/occupied-rooms'),
      api.get('/room-service/active'),
      api.get('/maintenance/open'),
      api.get('/dashboard/recent-events'),
    ])

    const failures = []

    if (roomsRes.status === 'fulfilled') {
      setRooms(roomsRes.value.map(room => ({
        number: room.number,
        floor: room.floor,
        type: room.room_type || room.type,
        status: room.status,
      })))
    } else {
      failures.push('Reception')
      setRooms([])
    }

    if (bookingsRes.status === 'fulfilled') {
      setBookings(bookingsRes.value.map(item => ({
        booking_id: item.booking_id,
        guest: item.guest_name,
        room_id: item.room_number,
      })))
    } else {
      failures.push('Reception bookings')
      setBookings([])
    }

    if (ordersRes.status === 'fulfilled') {
      setOrders(ordersRes.value.map(item => ({
        id: item.id,
        room_id: item.room_number,
        status: item.status,
        total: item.total_price,
      })))
    } else {
      failures.push('Room Service')
      setOrders([])
    }

    if (issuesRes.status === 'fulfilled') {
      setIssues(issuesRes.value.map(item => ({
        id: item.id,
        room_id: item.room_number,
        urgency: item.urgency,
        description: item.description,
      })))
    } else {
      failures.push('Maintenance')
      setIssues([])
    }

    if (recentEventsRes.status === 'fulfilled') {
      setEvents(
        recentEventsRes.value.map(item => ({
          id: item.id,
          time: item.published_at ? new Date(item.published_at).toLocaleTimeString() : '-',
          event: item.event,
          data: item.data,
        })),
      )
    } else {
      failures.push('Event log')
    }

    setWarning(failures.length ? `Ba'zi servislar javob bermadi: ${failures.join(', ')}` : '')
  }

  const wsHandlers = { _onConnect: loadSnapshot }
  WS_EVENTS.forEach(eventName => {
    wsHandlers[eventName] = data => {
      appendEvent(eventName, data)
      loadSnapshot()
    }
  })
  useWSEvents(wsHandlers)

  useEffect(() => {
    loadSnapshot()
    const timer = setInterval(loadSnapshot, 30000)
    return () => clearInterval(timer)
  }, [])

  const stats = [
    { label: 'Jami xonalar', value: rooms.length, color: '#1677ff', icon: <HomeOutlined /> },
    { label: 'Band', value: occupiedRoomNumbers.size, color: '#ff4d4f', icon: <TeamOutlined /> },
    { label: 'Faol buyurtma', value: orders.length, color: '#fa8c16', icon: <ShoppingCartOutlined /> },
    { label: 'Ochiq muammo', value: issues.length, color: '#722ed1', icon: <ToolOutlined /> },
  ]

  const orderCols = [
    { title: '#', dataIndex: 'id', render: value => `#${value}`, width: 60 },
    { title: 'Xona', dataIndex: 'room_id', width: 80 },
    { title: 'Jami', dataIndex: 'total', render: value => `$${value}`, width: 90 },
    { title: 'Holat', dataIndex: 'status', render: value => <Tag color={{ received: 'blue', preparing: 'orange', delivering: 'red', delivered: 'green' }[value]}>{value}</Tag> },
  ]
  const issueCols = [
    { title: '#', dataIndex: 'id', render: value => `#${value}`, width: 60 },
    { title: 'Xona', dataIndex: 'room_id', width: 80 },
    { title: 'Muhimlik', dataIndex: 'urgency', render: value => <Tag color={{ critical: 'red', high: 'orange', normal: 'blue', low: 'default' }[value]}>{value}</Tag>, width: 110 },
    { title: 'Tavsif', dataIndex: 'description', ellipsis: true },
  ]
  const bookingCols = [
    { title: 'Bron', dataIndex: 'booking_id', render: value => `#${value}`, width: 80 },
    { title: 'Mehmon', dataIndex: 'guest' },
    { title: 'Xona', dataIndex: 'room_id', width: 80 },
  ]

  return (
    <div style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 52px)', padding: 24 }}>
      {warning && <Alert type="warning" showIcon message={warning} className="mb-4" />}
      <div className="mb-4 text-xs text-gray-500">
        {Object.values(services).map(service => `${service.label || service.key}: ${service.online ? 'up' : service.online === false ? 'down' : '...'}`).join(' | ')}
      </div>

      <Row gutter={16} className="mb-6">
        {stats.map(stat => (
          <Col span={6} key={stat.label}>
            <Card>
              <Statistic
                title={<span style={{ color: '#666' }}>{stat.label}</span>}
                value={stat.value}
                prefix={<span style={{ color: stat.color }}>{stat.icon}</span>}
                valueStyle={{ color: stat.color, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="mb-5" title={<Space><HomeOutlined />Xonalar holati</Space>}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {rooms.map(room => {
            const hasActiveBooking = occupiedRoomNumbers.has(String(room.number))
            const statuses = [room.status]
            if (hasActiveBooking && !statuses.includes('occupied')) statuses.unshift('occupied')

            return (
              <div
                key={room.number}
                style={{
                  width: 84,
                  height: 84,
                  background: STATUS_BG[room.status],
                  borderRadius: 12,
                  padding: '8px 6px',
                  textAlign: 'center',
                  border: `1px solid ${STATUS_TEXT_COLOR[room.status]}33`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, color: STATUS_TEXT_COLOR[room.status] }}>{room.number}</div>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, minHeight: 24 }}>
                  {statuses.map(status => (
                    <Tooltip key={status} title={STATUS_LABEL[status] || status}>
                      <span style={{ fontSize: 18, lineHeight: 1, cursor: 'default' }}>
                        {STATUS_EMOJI[status] || '•'}
                      </span>
                    </Tooltip>
                  ))}
                </div>
                <div style={{ fontSize: 9, color: STATUS_TEXT_COLOR[room.status], opacity: 0.85, whiteSpace: 'nowrap' }}>
                  {statuses.length} status
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Row gutter={16} className="mb-5">
        <Col span={8}>
          <Card title={<Space><ShoppingCartOutlined />Faol buyurtmalar</Space>} style={{ height: '100%' }}>
            <Table dataSource={orders} columns={orderCols} rowKey="id" size="small" pagination={false} locale={{ emptyText: "Buyurtma yo'q" }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><ToolOutlined />Ochiq muammolar</Space>} style={{ height: '100%' }}>
            <Table dataSource={issues} columns={issueCols} rowKey="id" size="small" pagination={false} locale={{ emptyText: "Muammo yo'q" }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><TeamOutlined />Faol bronlar</Space>} style={{ height: '100%' }}>
            <Table dataSource={bookings} columns={bookingCols} rowKey="booking_id" size="small" pagination={false} locale={{ emptyText: "Bron yo'q" }} />
          </Card>
        </Col>
      </Row>

      <Card title="Event Log">
        {events.length === 0
          ? <p style={{ color: '#aaa', textAlign: 'center', padding: 16 }}>Voqealar kutilmoqda...</p>
          : events.map(event => (
            <div key={event.id} style={{ display: 'flex', gap: 8, fontSize: 12, borderBottom: '1px solid #f0f0f0', padding: '6px 0' }}>
              <span style={{ color: '#aaa', flexShrink: 0 }}>{event.time}</span>
              <Tag color="blue" style={{ flexShrink: 0 }}>{event.event}</Tag>
              <span style={{ color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {JSON.stringify(event.data)}
              </span>
            </div>
          ))}
      </Card>
    </div>
  )
}
