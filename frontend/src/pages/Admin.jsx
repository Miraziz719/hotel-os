import { useEffect, useState } from 'react'
import { Card, Table, Tag, Row, Col, Statistic, Space } from 'antd'
import {
  HomeOutlined, ShoppingCartOutlined, ToolOutlined, TeamOutlined,
} from '@ant-design/icons'
import { api } from '../utils/api'
import { useWSEvents } from '../hooks/WSContext'

const WS_EVENTS = [
  'dashboard_update', 'room_status_changed', 'guest_checked_in', 'guest_checked_out',
  'order_created', 'order_status_changed', 'issue_created', 'issue_resolved', 'housekeeping_requested',
]

const STATUS_COLOR = {
  clean: 'success', dirty: 'warning', occupied: 'error', cleaning: 'processing', maintenance: 'default',
}
const STATUS_BG = {
  clean: '#f6ffed', dirty: '#fffbe6', occupied: '#fff1f0', cleaning: '#e6f4ff', maintenance: '#f3f4f6',
}
const STATUS_TEXT_COLOR = {
  clean: '#52c41a', dirty: '#fa8c16', occupied: '#ff4d4f', cleaning: '#1677ff', maintenance: '#6b7280',
}
const STATUS_EMOJI = {
  clean: '✅', occupied: '🛏️', dirty: '🧹', cleaning: '🫧', maintenance: '🔧',
}

export default function Admin() {
  const [rooms,    setRooms]    = useState([])
  const [orders,   setOrders]   = useState([])
  const [issues,   setIssues]   = useState([])
  const [bookings, setBookings] = useState([])
  const [events,   setEvents]   = useState([])

  async function loadSnapshot() {
    try {
      const data = await api.get('/dashboard/snapshot')
      setRooms(data.rooms)
      setOrders(data.active_orders)
      setIssues(data.open_issues)
      setBookings(data.active_bookings)
    } catch {}
  }

  // Subscribe to every event: log it + reload the snapshot.
  const wsHandlers = { _onConnect: loadSnapshot }
  WS_EVENTS.forEach(ev => {
    wsHandlers[ev] = (data) => {
      setEvents(prev => [
        { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), event: ev, data },
        ...prev,
      ].slice(0, 30))
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
    { label: 'Jami xonalar',  value: rooms.length,                         color: '#1677ff', icon: <HomeOutlined /> },
    { label: 'Band',          value: rooms.filter(r=>r.status==='occupied').length, color: '#ff4d4f', icon: <TeamOutlined /> },
    { label: 'Faol buyurtma', value: orders.length,                        color: '#fa8c16', icon: <ShoppingCartOutlined /> },
    { label: 'Ochiq muammo',  value: issues.length,                        color: '#722ed1', icon: <ToolOutlined /> },
  ]

  const orderCols = [
    { title: '#',     dataIndex: 'id',     render: v => `#${v}`, width: 60 },
    { title: 'Xona',  dataIndex: 'room_id', width: 80 },
    { title: 'Jami',  dataIndex: 'total',   render: v => `$${v}`, width: 90 },
    {
      title: 'Holat', dataIndex: 'status',
      render: v => <Tag color={{ received:'blue', preparing:'orange', delivering:'red', delivered:'green' }[v]}>{v}</Tag>,
    },
  ]
  const issueCols = [
    { title: '#',        dataIndex: 'id',          render: v => `#${v}`, width: 60 },
    { title: 'Xona',     dataIndex: 'room_id',     width: 80 },
    { title: 'Muhimlik', dataIndex: 'urgency',     render: v => <Tag color={{ critical:'red', high:'orange', normal:'blue', low:'default' }[v]}>{v}</Tag>, width: 110 },
    { title: 'Tavsif',   dataIndex: 'description', ellipsis: true },
  ]
  const bookingCols = [
    { title: 'Bron',   dataIndex: 'booking_id', render: v => `#${v}`, width: 80 },
    { title: 'Mehmon', dataIndex: 'guest' },
    { title: 'Xona',   dataIndex: 'room_id', width: 80 },
  ]

  return (
    <div style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 52px)', padding: 24 }}>

      {/* Stats */}
      <Row gutter={16} className="mb-6">
        {stats.map(s => (
          <Col span={6} key={s.label}>
            <Card>
              <Statistic
                title={<span style={{ color: '#666' }}>{s.label}</span>}
                value={s.value}
                prefix={<span style={{ color: s.color }}>{s.icon}</span>}
                valueStyle={{ color: s.color, fontWeight: 700 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Rooms grid */}
      <Card
        className="mb-5"
        title={<Space><HomeOutlined />Xonalar holati</Space>}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {rooms.map(r => (
            <div
              key={r.number}
              style={{
                width: 80, background: STATUS_BG[r.status], borderRadius: 8,
                padding: '8px 4px', textAlign: 'center',
                border: `1px solid ${STATUS_TEXT_COLOR[r.status]}33`,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 15, color: STATUS_TEXT_COLOR[r.status] }}>{r.number}</div>
              <div style={{ fontSize: 18 }}>{STATUS_EMOJI[r.status]}</div>
              <div style={{ fontSize: 9, color: STATUS_TEXT_COLOR[r.status], opacity: 0.8 }}>{r.status}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tables row */}
      <Row gutter={16} className="mb-5">
        <Col span={8}>
          <Card title={<Space><ShoppingCartOutlined />Faol buyurtmalar</Space>} style={{ height: '100%' }}>
            <Table dataSource={orders} columns={orderCols} rowKey="id" size="small" pagination={false}
                   locale={{ emptyText: 'Buyurtma yo\'q' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><ToolOutlined />Ochiq muammolar</Space>} style={{ height: '100%' }}>
            <Table dataSource={issues} columns={issueCols} rowKey="id" size="small" pagination={false}
                   locale={{ emptyText: 'Muammo yo\'q' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title={<Space><TeamOutlined />Faol bronlar</Space>} style={{ height: '100%' }}>
            <Table dataSource={bookings} columns={bookingCols} rowKey="booking_id" size="small" pagination={false}
                   locale={{ emptyText: 'Bron yo\'q' }} />
          </Card>
        </Col>
      </Row>

      {/* Event log */}
      <Card title="Event Log">
        {events.length === 0
          ? <p style={{ color: '#aaa', textAlign: 'center', padding: 16 }}>Voqealar kutilmoqda...</p>
          : events.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: 12, borderBottom: '1px solid #f0f0f0', padding: '6px 0' }}>
              <span style={{ color: '#aaa', flexShrink: 0 }}>{e.time}</span>
              <Tag color="blue" style={{ flexShrink: 0 }}>{e.event}</Tag>
              <span style={{ color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {JSON.stringify(e.data)}
              </span>
            </div>
          ))
        }
      </Card>
    </div>
  )
}
