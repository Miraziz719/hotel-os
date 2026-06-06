import { useEffect, useMemo, useState } from 'react'
import { Tabs, Table, Button, Alert, Tag, Spin, Modal, Card, notification, Image } from 'antd'
import { ShoppingOutlined, UnorderedListOutlined, CheckCircleOutlined } from '@ant-design/icons'
import RoomServiceMenu from './RoomServiceMenu'
import { api } from '../utils/api'
import { playNotificationSound } from '../hooks/useWebSocket'
import { useWSEvents } from '../hooks/WSContext'

const STATUS_COLOR = { received:'blue', preparing:'orange', delivering:'red', delivered:'green' }
const STATUS_LABEL = { received:'Qabul qilindi', preparing:'Tayyorlanmoqda', delivering:'Yetkazilmoqda', delivered:'Tugatildi' }
const STATUS_ACTION = {
  received: { label: 'Tayyorlanmoqda', color: '#fa8c16' },
  preparing: { label: 'Yetkazilmoqda', color: '#ff4d4f' },
  delivering: { label: 'Tugatildi', color: '#52c41a' },
}

function byTag(by) {
  if (!by) return <Tag>-</Tag>
  if (by.startsWith('guest')) return <Tag color="pink">{by}</Tag>
  if (by.startsWith('reception')) return <Tag color="blue">{by}</Tag>
  if (by.startsWith('admin')) return <Tag color="gold">{by}</Tag>
  if (by.startsWith('room_service')) return <Tag color="orange">{by}</Tag>
  return <Tag>{by}</Tag>
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function OrderDetailsModal({ order, open, onClose }) {
  if (!order) return null

  let items = []
  try { items = JSON.parse(order.items) } catch { items = [] }

  const steps = [
    { label: 'Buyurtma berildi', by: order.ordered_by,   at: order.created_at,   note: null,                   img: null                    },
    { label: 'Tayyorlanmoqda',   by: order.preparing_by,  at: order.preparing_at,  note: order.preparing_note,   img: order.preparing_image_url  },
    { label: 'Yetkazilmoqda',    by: order.delivering_by, at: order.delivering_at, note: order.delivering_note,  img: order.delivering_image_url },
    { label: 'Tugatildi',        by: order.delivered_by,  at: order.delivered_at,  note: order.delivered_note,   img: order.delivered_image_url  },
  ]

  return (
    <Modal title={null} open={open} onCancel={onClose} footer={null} width={580}>
      {/* Header */}
      <div className="mb-5 pr-6">
        <div className="text-xs uppercase tracking-wide text-gray-400">Buyurtma</div>
        <div className="text-2xl font-bold leading-tight mt-1">
          #{order.id} — Xona {order.room_number || order.room_id}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Tag color={STATUS_COLOR[order.status]} className="m-0">
            {STATUS_LABEL[order.status] || order.status}
          </Tag>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Kim buyurtma berdi</div>
          <div className="font-medium mt-1">{order.ordered_by || '—'}</div>
          <div className="text-xs text-gray-400 mt-1">{formatDateTime(order.created_at)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Jami summa</div>
          <div className="font-semibold text-lg mt-1">${order.total_price}</div>
          <div className="text-xs text-gray-400 mt-1">{items.length} xil mahsulot</div>
        </div>
      </div>

      {/* Items */}
      <div className="mb-5">
        <div className="font-semibold mb-2">Mahsulotlar</div>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {items.length > 0
            ? items.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
                <div>
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className="text-xs text-gray-500">{item.quantity} ta × ${item.unit_price}</div>
                </div>
                <div className="font-semibold text-sm">${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</div>
              </div>
            ))
            : <div className="px-4 py-3 text-sm text-gray-400">—</div>}
        </div>
      </div>

      {/* Status timeline */}
      <div>
        <div className="font-semibold mb-3">Jarayon holati</div>
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={step.label} className="flex gap-3 rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex flex-col items-center pt-1">
                <div className={`h-3 w-3 rounded-full flex-shrink-0 ${step.at ? 'bg-orange-500' : 'bg-gray-300'}`} />
                {idx < steps.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-2" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{step.label}</div>
                <div className="text-sm text-gray-500 mt-0.5">{step.by || 'Hali bajarilmagan'}</div>
                {step.at && <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(step.at)}</div>}
                {step.note && <div className="text-xs text-gray-600 mt-1 italic">"{step.note}"</div>}
                {step.img && (
                  <Image src={step.img} alt="step" style={{ maxWidth: 160, maxHeight: 100, objectFit: 'cover', borderRadius: 8, marginTop: 6 }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function OrdersTable({ title, orders, loading, onRefresh, onAdvanceOrder, updatingId, allowAdvance }) {
  const [selectedOrder, setSelectedOrder] = useState(null)

  const baseCols = [
    { title:'#', dataIndex:'id', render:v => `#${v}`, width:60 },
    { title:'Xona', dataIndex:'room_number', width:80 },
    { title:'Tarkib', dataIndex:'items', render:v => { try { return JSON.parse(v).map(i => `${i.name} x ${i.quantity}`).join(', ') } catch { return v } } },
    { title:'Jami', dataIndex:'total_price', render:v => `$${v}`, width:90 },
    { title:'Kim berdi', dataIndex:'ordered_by', render:byTag },
    { title:'Holat', dataIndex:'status', render:v => <Tag color={STATUS_COLOR[v]}>{STATUS_LABEL[v] || v}</Tag>, width:140 },
  ]

  const cols = allowAdvance
    ? [
      ...baseCols,
      {
        title:'Amal',
        key:'action',
        width:180,
        render:(_, record) => {
          const action = STATUS_ACTION[record.status]
          if (!action) return null
          return (
            <Button
              type="primary"
              size="small"
              loading={updatingId === record.id}
              onClick={event => {
                event.stopPropagation()
                onAdvanceOrder(record.id)
              }}
              style={{ background: action.color, borderColor: action.color }}
            >
              {action.label}
            </Button>
          )
        },
      },
    ]
    : baseCols

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-base">{title}</div>
        <Button size="small" onClick={onRefresh} loading={loading}>Yangilash</Button>
      </div>
      <Table
        dataSource={orders}
        columns={cols}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText: 'Hozircha buyurtma yo‘q' }}
        onRow={record => ({
          onClick: () => setSelectedOrder(record),
          style: { cursor: 'pointer' },
        })}
      />
      <OrderDetailsModal order={selectedOrder} open={!!selectedOrder} onClose={() => setSelectedOrder(null)} />
    </Card>
  )
}

function MenuTab({ isGuest, roomNumber }) {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(!isGuest)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isGuest) return

    let active = true
    async function load() {
      try {
        setError('')
        const data = await api.get('/reception/occupied-rooms')
        if (!active) return
        setRooms(
          data
            .map(r => ({ value: r.room_number, label: `Xona ${r.room_number} - ${r.room_type}` })),
        )
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => { active = false }
  }, [isGuest])

  if (loading) return <div className="py-16 text-center"><Spin size="large" /></div>
  if (error) return <Alert type="error" message={error} showIcon />

  return (
    <RoomServiceMenu
      roomNumber={roomNumber}
      allowRoomSelection={!isGuest}
      roomOptions={rooms}
      title="Yangi buyurtma"
      successText="Buyurtma muvaffaqiyatli yaratildi!"
    />
  )
}

export default function RoomServiceWorkspace({ isGuest = false, roomNumber = '' }) {
  const [activeOrders, setActiveOrders] = useState([])
  const [completedOrders, setCompletedOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  async function loadOrders() {
    setLoading(true)
    try {
      if (isGuest) {
        const orders = await api.get('/room-service/my-orders')
        setActiveOrders(orders.filter(order => order.status !== 'delivered'))
        setCompletedOrders(orders.filter(order => order.status === 'delivered'))
      } else {
        const [active, completed] = await Promise.all([
          api.get('/room-service/active'),
          api.get('/room-service/completed'),
        ])
        setActiveOrders(active)
        setCompletedOrders(completed)
      }
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
    const t = setInterval(loadOrders, 15000)
    return () => clearInterval(t)
  }, [isGuest])

  useWSEvents({
    _onConnect: loadOrders,
    order_created: (data) => {
      if (!isGuest) {
        notification.info({
          message: 'Yangi buyurtma!',
          description: `Xona ${data.room_number} — $${data.total}`,
          placement: 'topRight',
        })
      }
      loadOrders()
    },
    order_status_changed: (data) => {
      if (isGuest) {
        if (data.new_status === 'delivered' && data.room_number === roomNumber) {
          playNotificationSound()
          notification.success({
            message: 'Buyurtmangiz yetkazildi!',
            description: `#${data.order_id} raqamli buyurtmangiz xonangizga yetkazildi.`,
            placement: 'topRight',
            duration: 8,
          })
        }
      } else {
        notification.info({
          message: "Buyurtma holati o'zgardi",
          description: `#${data.order_id}: ${STATUS_LABEL[data.new_status] || data.new_status}`,
          placement: 'topRight',
        })
      }
      loadOrders()
    },
  })

  function advanceOrder(orderId) {
    if (isGuest) return
    doAdvanceOrder(orderId)
  }

  async function doAdvanceOrder(orderId) {
    setMessage(null)
    setUpdatingId(orderId)
    try {
      const data = await api.post(`/room-service/order/${orderId}/advance`, {
        note: null,
        image_url: null,
      })
      setMessage({ type: 'success', text: data.message })
      await loadOrders()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setUpdatingId(null)
    }
  }

  const tabs = useMemo(() => {
    const menuTab = {
      key: 'menu',
      label: <span><ShoppingOutlined className="mr-1" />Menyu</span>,
      children: <MenuTab isGuest={isGuest} roomNumber={roomNumber} />,
    }

    const activeTab = {
      key: 'active',
      label: <span><UnorderedListOutlined className="mr-1" />Faol buyurtmalar</span>,
      children: (
        <OrdersTable
          title={isGuest ? 'Mening faol buyurtmalarim' : 'Faol buyurtmalar'}
          orders={activeOrders}
          loading={loading}
          onRefresh={loadOrders}
          onAdvanceOrder={advanceOrder}
          updatingId={updatingId}
          allowAdvance={!isGuest}
        />
      ),
    }

    const completedTab = {
      key: 'completed',
      label: <span><CheckCircleOutlined className="mr-1" />Tugatilganlar</span>,
      children: (
        <OrdersTable
          title={isGuest ? 'Mening tugatilgan buyurtmalarim' : 'Tugatilgan buyurtmalar'}
          orders={completedOrders}
          loading={loading}
          onRefresh={loadOrders}
          onAdvanceOrder={advanceOrder}
          updatingId={updatingId}
          allowAdvance={false}
        />
      ),
    }

    return [menuTab, activeTab, completedTab]
  }, [activeOrders, completedOrders, isGuest, loading, roomNumber, updatingId])

  return (
    <>
      <div>
        {message && <Alert type={message.type} message={message.text} showIcon className="mb-4" />}
        <Tabs defaultActiveKey="menu" items={tabs} size="large" />
      </div>
    </>
  )
}
