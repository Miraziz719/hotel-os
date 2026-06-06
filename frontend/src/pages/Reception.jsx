import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Checkbox, Empty, Form, Input, InputNumber, Select, Table, Tabs, Tag, notification } from 'antd'
import { AppstoreOutlined, HistoryOutlined, LoginOutlined, TeamOutlined } from '@ant-design/icons'
import { api } from '../utils/api'
import { useWSEvents } from '../hooks/WSContext'

const ROOM_TYPE_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'suite', label: 'Suite' },
  { value: 'accessible', label: 'Accessible' },
]

const ROOM_STATUS_LABEL = {
  clean: 'Bo`sh',
  occupied: 'Band',
  dirty: 'Tozalashda',
  cleaning: 'Tozalanmoqda',
  maintenance: 'Texnik xizmatda',
}

const ROOM_STATUS_TAG_COLOR = {
  clean: 'default',
  occupied: 'success',
  dirty: 'warning',
  cleaning: 'warning',
  maintenance: 'default',
}

const ROOM_STATUS_CARD_STYLE = {
  clean:       { borderColor: '#d9e3f0', background: '#ffffff',                                              shadow: 'none' },
  occupied:    { borderColor: '#8bd7a5', background: 'linear-gradient(135deg,#eefcf2,#f8fffa)',              shadow: '0 10px 22px rgba(34,197,94,0.10)' },
  dirty:       { borderColor: '#f5d06f', background: 'linear-gradient(135deg,#fff9e9,#fffdf4)',              shadow: '0 10px 22px rgba(245,158,11,0.10)' },
  cleaning:    { borderColor: '#f5d06f', background: 'linear-gradient(135deg,#fff9e9,#fffdf4)',              shadow: '0 10px 22px rgba(245,158,11,0.10)' },
  maintenance: { borderColor: '#d1d5db', background: 'linear-gradient(135deg,#f3f4f6,#f9fafb)',              shadow: '0 10px 22px rgba(107,114,128,0.08)' },
}

function formatMoney(value) {
  const num = Number(value || 0)
  return `$${num.toFixed(2)}`
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function buildPreviewUrl(roomNumber, discount, extraCharges) {
  const params = new URLSearchParams({
    discount: String(discount || 0),
    extra_charges: String(extraCharges || 0),
  })
  return `/reception/checkout-preview/${roomNumber}?${params.toString()}`
}

function RoomCard({ room, selected = false, onSelect, showStatus = true }) {
  const statusStyle = ROOM_STATUS_CARD_STYLE[room.status] || ROOM_STATUS_CARD_STYLE.clean
  const isMaintenance = room.status === 'maintenance'
  const clickable = typeof onSelect === 'function' && !isMaintenance

  return (
    <button
      type="button"
      onClick={() => clickable && onSelect?.(room)}
      className="text-left rounded-2xl border p-4 transition-all"
      style={{
        borderColor: selected ? '#2d5be3' : statusStyle.borderColor,
        background: selected ? 'linear-gradient(135deg,#eef4ff,#f8fbff)' : statusStyle.background,
        boxShadow: selected ? '0 10px 24px rgba(45,91,227,0.12)' : statusStyle.shadow,
        cursor: isMaintenance ? 'not-allowed' : clickable ? 'pointer' : 'default',
        opacity: isMaintenance ? 0.85 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-gray-500 uppercase tracking-wide">Xona</div>
          <div className="text-2xl font-bold leading-tight">{room.number}</div>
        </div>
        {showStatus && (
          <Tag color={ROOM_STATUS_TAG_COLOR[room.status]}>
            {ROOM_STATUS_LABEL[room.status] || room.status}
          </Tag>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-gray-500">Turi</div>
          <div className="font-medium mt-1 capitalize">{room.room_type}</div>
        </div>
        <div>
          <div className="text-gray-500">Qavat</div>
          <div className="font-medium mt-1">{room.floor}</div>
        </div>
        <div>
          <div className="text-gray-500">Narxi</div>
          <div className="font-medium mt-1">{formatMoney(room.nightly_rate)}</div>
        </div>
        <div>
          <div className="text-gray-500">Lift</div>
          <div className="font-medium mt-1">{room.near_lift ? 'Yaqin' : 'Oddiy'}</div>
        </div>
      </div>
    </button>
  )
}

function CheckOutPanel({ room, onCompleted }) {
  const [preview, setPreview] = useState(null)
  const [discount, setDiscount] = useState(0)
  const [extraCharges, setExtraCharges] = useState(0)
  const [extraReason, setExtraReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!room) return undefined

    let active = true
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.get(buildPreviewUrl(room.room_number, discount, extraCharges))
        if (!active) return
        setPreview(data)
      } catch (e) {
        if (active) setMessage({ type: 'error', text: e.message })
      } finally {
        if (active) setLoading(false)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [room, discount, extraCharges])

  useEffect(() => {
    if (!room) {
      setPreview(null)
      setDiscount(0)
      setExtraCharges(0)
      setExtraReason('')
      setMessage(null)
    }
  }, [room])

  async function handleCheckout() {
    if (!room) return
    setMessage(null)
    setConfirming(true)
    try {
      const res = await api.post('/reception/check-out', {
        room_number: room.room_number,
        discount,
        extra_charges: extraCharges,
        extra_charge_reason: extraReason || null,
      })
      setMessage({ type: 'success', text: res.message })
      onCompleted()
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Card
      size="small"
      title="Check-out ma'lumotlari"
      extra={room ? <Tag color="green">Xona {room.room_number}</Tag> : null}
    >
      {!room ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-gray-500">
          Chap tomondan band xonani tanlang.
        </div>
      ) : (
        <>
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Check-out</div>
            <div className="text-2xl font-bold mt-1">Xona {room?.room_number}</div>
            <div className="text-sm text-gray-500 mt-1">{room?.guest_name}</div>
            <div className="text-xs text-gray-400 mt-0.5">{room?.guest_phone}</div>
          </div>
          <Tag color="success" className="px-3 py-1 text-sm m-0">Band xona</Tag>
        </div>
      </div>

      {message && <Alert type={message.type} message={message.text} showIcon className="mb-4" />}

      <div className="grid md:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Check-in vaqti</div>
          <div className="font-semibold mt-1">{formatDateTime(preview?.check_in || room?.check_in)}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Tunlar soni</div>
          <div className="font-semibold mt-1">{preview?.nights ?? room?.nights}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Jami summa</div>
          <div className="font-semibold text-lg mt-1">{formatMoney(preview?.total ?? room?.total_due)}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-5">
        <Card size="small" title="Hisob-kitob">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Xona narxi</span>
              <span className="font-medium">{formatMoney(preview?.nightly_rate ?? room?.nightly_rate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Turar joy</span>
              <span className="font-medium">{formatMoney(preview?.room_charges ?? room?.room_charges)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Oshxona xizmati</span>
              <span className="font-medium">{formatMoney(preview?.service_charges ?? room?.service_charges)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Chegirma</span>
              <span className="font-medium">-{formatMoney(preview?.discount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Qo'shimcha</span>
              <span className="font-medium">{formatMoney(preview?.extra_charges)}</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t font-semibold">
              <span>Yakuniy summa</span>
              <span>{formatMoney(preview?.total ?? room?.total_due)}</span>
            </div>
          </div>
        </Card>

        <Card size="small" title="Sozlamalar">
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500 mb-1">Chegirma</div>
              <InputNumber min={0} step={1} value={discount} onChange={value => setDiscount(value || 0)} className="w-full" />
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Qo'shimcha to'lov</div>
              <InputNumber min={0} step={1} value={extraCharges} onChange={value => setExtraCharges(value || 0)} className="w-full" />
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Izoh</div>
              <Input.TextArea rows={3} value={extraReason} onChange={event => setExtraReason(event.target.value)} placeholder="Masalan: minibar yoki kech checkout" />
            </div>
          </div>
        </Card>
      </div>

      <Card size="small" title={`Oshxona buyurtmalari (${preview?.service_orders_count ?? room?.service_orders_count ?? 0})`} className="mb-5">
        {preview?.orders?.length ? (
          <div className="space-y-3">
            {preview.orders.map(order => (
              <div key={order.id} className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">Buyurtma #{order.id}</div>
                  <div className="flex items-center gap-2">
                    <Tag>{order.status}</Tag>
                    <span className="text-sm font-semibold">{formatMoney(order.total_price)}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{formatDateTime(order.created_at)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {order.items?.length
                    ? order.items.map((item, index) => (
                      <Tag key={`${order.id}-${index}`} color="orange">
                        {item.name} x {item.quantity}
                      </Tag>
                    ))
                    : <span className="text-sm text-gray-400">Mahsulot topilmadi</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Oshxona buyurtmasi yo'q" />
        )}
      </Card>

      <div className="flex justify-end">
        <Button danger type="primary" loading={confirming} onClick={handleCheckout}>
          Check-out qilish
        </Button>
      </div>
        </>
      )}
    </Card>
  )
}

export default function Reception() {
  const [form] = Form.useForm()
  const [filters, setFilters] = useState({ room_type: undefined, floor: undefined, near_lift: false })
  const [occupiedFilters, setOccupiedFilters] = useState({ search: '', room_type: 'all', floor: undefined })
  const [allRoomFilters, setAllRoomFilters] = useState({ room_type: undefined, floor: undefined, near_lift: false, status: 'all' })
  const [availableRooms, setAvailableRooms] = useState([])
  const [occupiedRooms, setOccupiedRooms] = useState([])
  const [allRooms, setAllRooms] = useState([])
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [selectedOccupiedRoom, setSelectedOccupiedRoom] = useState(null)
  const [loadingAvailable, setLoadingAvailable] = useState(true)
  const [loadingOccupied, setLoadingOccupied] = useState(true)
  const [loadingAllRooms, setLoadingAllRooms] = useState(true)
  const [guestHistory, setGuestHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  async function loadAvailableRooms(currentFilters = filters) {
    setLoadingAvailable(true)
    try {
      const params = new URLSearchParams()
      if (currentFilters.room_type) params.set('room_type', currentFilters.room_type)
      if (currentFilters.floor) params.set('floor', String(currentFilters.floor))
      if (currentFilters.near_lift) params.set('near_lift', 'true')
      const data = await api.get(`/reception/available-rooms${params.toString() ? `?${params.toString()}` : ''}`)
      setAvailableRooms(data)
      setSelectedRoom(prev => data.find(room => room.number === prev?.number) || null)
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setLoadingAvailable(false)
    }
  }

  async function loadOccupiedRooms() {
    setLoadingOccupied(true)
    try {
      const data = await api.get('/reception/occupied-rooms')
      setOccupiedRooms(data)
      setSelectedOccupiedRoom(prev => data.find(room => room.booking_id === prev?.booking_id) || null)
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setLoadingOccupied(false)
    }
  }

  async function loadAllRooms() {
    setLoadingAllRooms(true)
    try {
      setAllRooms(await api.get('/reception/rooms'))
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setLoadingAllRooms(false)
    }
  }

  useEffect(() => {
    loadAvailableRooms(filters)
    loadOccupiedRooms()
    loadAllRooms()
  }, [])

  useWSEvents({
    _onConnect: () => {
      loadAvailableRooms(filters)
      loadOccupiedRooms()
      loadAllRooms()
    },
    guest_checked_in: (data) => {
      notification.success({
        message: 'Check-in amalga oshirildi',
        description: `${data.guest_name} — Xona ${data.room_number}`,
        placement: 'topRight',
      })
      loadAvailableRooms(filters)
      loadOccupiedRooms()
      loadAllRooms()
    },
    guest_checked_out: (data) => {
      notification.info({
        message: "Check-out amalga oshirildi",
        description: `Xona ${data.room_number} bo'shatildi`,
        placement: 'topRight',
      })
      loadAvailableRooms(filters)
      loadOccupiedRooms()
      loadAllRooms()
    },
    room_status_changed: () => {
      loadAvailableRooms(filters)
      loadOccupiedRooms()
      loadAllRooms()
    },
  })

  async function handleCheckIn(values) {
    if (!selectedRoom) {
      setMessage({ type: 'error', text: 'Avval bo`sh xonani tanlang.' })
      return
    }

    setMessage(null)
    setSubmitting(true)
    try {
      const res = await api.post('/reception/check-in', {
        guest: {
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
        },
        room_type: selectedRoom.room_type,
        room_number: selectedRoom.number,
        floor_preference: filters.floor || null,
        lift_preference: filters.near_lift,
      })
      setMessage({ type: 'success', text: res.message })
      form.resetFields()
      setSelectedRoom(null)
      await Promise.all([loadAvailableRooms(filters), loadOccupiedRooms(), loadAllRooms()])
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setSubmitting(false)
    }
  }

  const filteredOccupiedRooms = useMemo(() => (
    occupiedRooms.filter(room => {
      const search = occupiedFilters.search.trim().toLowerCase()
      const matchesSearch = !search
        || room.room_number.toLowerCase().includes(search)
        || room.guest_name.toLowerCase().includes(search)
      const matchesType = occupiedFilters.room_type === 'all' || room.room_type === occupiedFilters.room_type
      const matchesFloor = !occupiedFilters.floor || room.floor === occupiedFilters.floor
      return matchesSearch && matchesType && matchesFloor
    })
  ), [occupiedRooms, occupiedFilters])

  function OccupiedRoomCard({ room, selected, onSelect }) {
    return (
      <button
        type="button"
        onClick={() => onSelect(room)}
        className="text-left rounded-2xl border p-4 transition-all"
        style={{
          borderColor: selected ? '#16a34a' : '#8bd7a5',
          background: selected ? 'linear-gradient(135deg,#eefcf2,#f8fffa)' : 'linear-gradient(135deg,#f8fffa,#ffffff)',
          boxShadow: selected ? '0 10px 24px rgba(34,197,94,0.12)' : '0 8px 18px rgba(34,197,94,0.06)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide">Xona</div>
            <div className="text-2xl font-bold leading-tight">{room.room_number}</div>
          </div>
          <Tag color="success">Band</Tag>
        </div>

        <div className="mt-3 font-medium">{room.guest_name}</div>
        <div className="text-xs text-gray-500 mt-0.5">{room.guest_phone}</div>
        <div className="text-xs text-gray-400 mt-1">{formatDateTime(room.check_in)}</div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-500">Turi</div>
            <div className="font-medium mt-1 capitalize">{room.room_type}</div>
          </div>
          <div>
            <div className="text-gray-500">Qavat</div>
            <div className="font-medium mt-1">{room.floor}</div>
          </div>
        </div>
      </button>
    )
  }

  const filteredAllRooms = useMemo(() => (
    allRooms.filter(room => {
      const matchesType = !allRoomFilters.room_type || room.room_type === allRoomFilters.room_type
      const matchesFloor = !allRoomFilters.floor || room.floor === allRoomFilters.floor
      const matchesLift = !allRoomFilters.near_lift || room.near_lift
      const matchesStatus = allRoomFilters.status === 'all' || room.status === allRoomFilters.status
      return matchesType && matchesFloor && matchesLift && matchesStatus
    })
  ), [allRooms, allRoomFilters])

  const occupiedColumns = [
    { title: 'Xona', dataIndex: 'room_number', width: 90, render: value => <span className="font-semibold">{value}</span> },
    { title: 'Mehmon', dataIndex: 'guest_name' },
    { title: 'Turi', dataIndex: 'room_type', width: 110, render: value => <Tag>{value}</Tag> },
    { title: 'Check-in', dataIndex: 'check_in', width: 180, render: formatDateTime },
    { title: 'Xona summasi', dataIndex: 'room_charges', width: 130, render: formatMoney },
    { title: 'Oshxona', dataIndex: 'service_charges', width: 110, render: formatMoney },
    { title: 'Jami', dataIndex: 'total_due', width: 110, render: value => <span className="font-semibold">{formatMoney(value)}</span> },
    {
      title: 'Amal',
      key: 'action',
      width: 140,
      render: (_, record) => (
        <Button danger onClick={() => setCheckoutRoom(record)}>
          Check-out
        </Button>
      ),
    },
  ]

  const tabs = [
    {
      key: 'checkin',
      label: <span><LoginOutlined className="mr-1" />Check-in</span>,
      children: (
        <div className="space-y-5">
          {message && <Alert type={message.type} message={message.text} showIcon />}

          <Card>
            <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-5">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-sm text-gray-500">Bo'sh xonalar</div>
                    <div className="text-2xl font-bold mt-1">Mehmon uchun xona tanlang</div>
                  </div>
                  <Button onClick={() => loadAvailableRooms(filters)} loading={loadingAvailable}>Yangilash</Button>
                </div>

                <div className="grid md:grid-cols-3 gap-3 mb-4">
                  <Select
                    allowClear
                    placeholder="Xona turi"
                    options={ROOM_TYPE_OPTIONS}
                    value={filters.room_type}
                    onChange={value => setFilters(prev => ({ ...prev, room_type: value }))}
                  />
                  <InputNumber
                    min={1}
                    max={20}
                    className="w-full"
                    placeholder="Qavat"
                    value={filters.floor}
                    onChange={value => setFilters(prev => ({ ...prev, floor: value || undefined }))}
                  />
                  <label className="flex items-center rounded-xl border border-gray-200 px-3">
                    <Checkbox
                      checked={filters.near_lift}
                      onChange={event => setFilters(prev => ({ ...prev, near_lift: event.target.checked }))}
                    >
                      Lift yaqinida
                    </Checkbox>
                  </label>
                </div>

                <div className="flex gap-3 mb-4">
                  <Button type="primary" onClick={() => loadAvailableRooms(filters)}>Filterlash</Button>
                  <Button
                    onClick={() => {
                      const next = { room_type: undefined, floor: undefined, near_lift: false }
                      setFilters(next)
                      loadAvailableRooms(next)
                    }}
                  >
                    Tozalash
                  </Button>
                </div>

                {availableRooms.length ? (
                  <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-4">
                    {availableRooms.map(room => (
                      <RoomCard
                        key={room.number}
                        room={room}
                        selected={selectedRoom?.number === room.number}
                        onSelect={setSelectedRoom}
                      />
                    ))}
                  </div>
                ) : (
                  <Card size="small">
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Mos bo'sh xona topilmadi" />
                  </Card>
                )}
              </div>

              <Card
                size="small"
                title="Mehmon ma'lumotlari"
                extra={selectedRoom ? <Tag color="blue">Tanlangan xona: {selectedRoom.number}</Tag> : null}
              >
                <Form form={form} layout="vertical" onFinish={handleCheckIn}>
                  <Form.Item name="full_name" label="To'liq ism" rules={[{ required: true, message: "Ismni kiriting" }]}>
                    <Input placeholder="Ali Valiyev" />
                  </Form.Item>
                  <Form.Item name="phone" label="Telefon" rules={[{ required: true, message: "Telefon raqamini kiriting" }]}>
                    <Input placeholder="+998901234567" />
                  </Form.Item>
                  <Form.Item name="email" label="Email" rules={[{ type: 'email', message: "To'g'ri email kiriting" }]}>
                    <Input placeholder="ali@example.com" />
                  </Form.Item>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4">
                    <div className="text-xs text-gray-500">Biriktiriladigan xona</div>
                    <div className="font-semibold mt-1">
                      {selectedRoom ? `${selectedRoom.number} | ${selectedRoom.room_type} | ${selectedRoom.floor}-qavat` : 'Xona tanlanmagan'}
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      {selectedRoom ? `Tunlik narx: ${formatMoney(selectedRoom.nightly_rate)}` : "Chap tomondan bo'sh xonani tanlang."}
                    </div>
                  </div>
                  <Button type="primary" htmlType="submit" block size="large" loading={submitting}>
                    Check-in qilish
                  </Button>
                </Form>
              </Card>
            </div>
          </Card>
        </div>
      ),
    },
    {
      key: 'occupied',
      label: <span><TeamOutlined className="mr-1" />Check-out</span>,
      children: (
        <Card>
          <div className="grid lg:grid-cols-[1.1fr,0.9fr] gap-5">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-gray-500">Check-out</div>
                  <div className="text-2xl font-bold mt-1">Band xonani tanlang</div>
                </div>
                <Button onClick={loadOccupiedRooms} loading={loadingOccupied}>Yangilash</Button>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mb-4">
                <Input
                  placeholder="Xona yoki mehmon bo'yicha qidirish"
                  value={occupiedFilters.search}
                  onChange={event => setOccupiedFilters(prev => ({ ...prev, search: event.target.value }))}
                />
                <Select
                  value={occupiedFilters.room_type}
                  options={[{ value: 'all', label: 'Barcha turlar' }, ...ROOM_TYPE_OPTIONS]}
                  onChange={value => setOccupiedFilters(prev => ({ ...prev, room_type: value }))}
                />
                <InputNumber
                  min={1}
                  max={20}
                  className="w-full"
                  placeholder="Qavat"
                  value={occupiedFilters.floor}
                  onChange={value => setOccupiedFilters(prev => ({ ...prev, floor: value || undefined }))}
                />
              </div>

              {filteredOccupiedRooms.length ? (
                <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-4">
                  {filteredOccupiedRooms.map(room => (
                    <OccupiedRoomCard
                      key={room.booking_id}
                      room={room}
                      selected={selectedOccupiedRoom?.booking_id === room.booking_id}
                      onSelect={setSelectedOccupiedRoom}
                    />
                  ))}
                </div>
              ) : (
                <Card size="small">
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Hozircha band xona yo'q" />
                </Card>
              )}
            </div>

            <CheckOutPanel
              room={selectedOccupiedRoom}
              onCompleted={() => {
                setSelectedOccupiedRoom(null)
                loadAvailableRooms(filters)
                loadOccupiedRooms()
                loadAllRooms()
              }}
            />
          </div>
        </Card>
      ),
    },
    {
      key: 'all-rooms',
      label: <span><AppstoreOutlined className="mr-1" />Barcha xonalar</span>,
      children: (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm text-gray-500">Barcha xonalar</div>
              <div className="text-2xl font-bold mt-1">Xonalar holati va filterlar</div>
            </div>
            <Button onClick={loadAllRooms} loading={loadingAllRooms}>Yangilash</Button>
          </div>

          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <Select
              allowClear
              placeholder="Xona turi"
              options={ROOM_TYPE_OPTIONS}
              value={allRoomFilters.room_type}
              onChange={value => setAllRoomFilters(prev => ({ ...prev, room_type: value }))}
            />
            <InputNumber
              min={1}
              max={20}
              className="w-full"
              placeholder="Qavat"
              value={allRoomFilters.floor}
              onChange={value => setAllRoomFilters(prev => ({ ...prev, floor: value || undefined }))}
            />
            <Select
              value={allRoomFilters.status}
              options={[
                { value: 'all', label: 'Barcha statuslar' },
                { value: 'clean', label: 'Bo`sh' },
                { value: 'occupied', label: 'Band' },
                { value: 'dirty', label: 'Tozalashda' },
                { value: 'cleaning', label: 'Tozalanmoqda' },
                { value: 'maintenance', label: 'Texnik xizmatda' },
              ]}
              onChange={value => setAllRoomFilters(prev => ({ ...prev, status: value }))}
            />
            <label className="flex items-center rounded-xl border border-gray-200 px-3">
              <Checkbox
                checked={allRoomFilters.near_lift}
                onChange={event => setAllRoomFilters(prev => ({ ...prev, near_lift: event.target.checked }))}
              >
                Lift yaqinida
              </Checkbox>
            </label>
          </div>

          <div className="flex gap-3 mb-4">
            <Button
              onClick={() => setAllRoomFilters({ room_type: undefined, floor: undefined, near_lift: false, status: 'all' })}
            >
              Tozalash
            </Button>
          </div>

          {filteredAllRooms.length ? (
            <div className="grid 2xl:grid-cols-5 xl:grid-cols-5 md:grid-cols-3 gap-4">
              {filteredAllRooms.map(room => (
                <RoomCard key={room.number} room={room} />
              ))}
            </div>
          ) : (
            <Card size="small">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Mos xona topilmadi" />
            </Card>
          )}
        </Card>
      ),
    },
    {
      key: 'history',
      label: <span><HistoryOutlined className="mr-1" />Mehmonlar tarixi</span>,
      children: (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-base">Check-out qilgan mehmonlar</div>
            <Button
              onClick={async () => {
                setLoadingHistory(true)
                try { setGuestHistory(await api.get('/reception/guest-history')) } catch {}
                finally { setLoadingHistory(false) }
              }}
              loading={loadingHistory}
            >
              Yangilash
            </Button>
          </div>
          <Table
            dataSource={guestHistory}
            rowKey="booking_id"
            size="small"
            loading={loadingHistory}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            locale={{ emptyText: "Hozircha tarix yo'q" }}
            columns={[
              { title: 'Xona', dataIndex: 'room_number', width: 80, render: v => <span className="font-semibold">{v}</span> },
              { title: 'Mehmon', dataIndex: 'guest_name' },
              { title: 'Telefon', dataIndex: 'guest_phone', width: 150 },
              { title: 'Turi', dataIndex: 'room_type', width: 110, render: v => <Tag>{v}</Tag> },
              { title: 'Check-in', dataIndex: 'check_in', width: 160, render: formatDateTime },
              { title: 'Check-out', dataIndex: 'check_out', width: 160, render: formatDateTime },
            ]}
          />
        </Card>
      ),
    },
  ]

  return (
    <div className="p-6" style={{ background: '#f0f4ff', minHeight: 'calc(100vh - 52px)' }}>
      <Tabs
        defaultActiveKey="checkin"
        items={tabs}
        size="large"
        onChange={async (key) => {
          if (key === 'history' && guestHistory.length === 0) {
            setLoadingHistory(true)
            try { setGuestHistory(await api.get('/reception/guest-history')) } catch {}
            finally { setLoadingHistory(false) }
          }
        }}
      />
    </div>
  )
}
