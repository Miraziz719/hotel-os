import { useMemo, useState } from 'react'
import { Card, Button, Alert, Tag, Row, Col, Modal, Divider, Select } from 'antd'
import { ShoppingCartOutlined, MinusOutlined, PlusOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { api } from '../utils/api'

const USD_FORMATTER = new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' })

const MENU = [
  {
    title: 'Ovqatlar',
    items: [
      { key: 'club_sandwich', name: 'Club Sandwich', price: 8, note: 'Tovuq, pishloq va fri bilan', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80' },
      { key: 'burger', name: 'Classic Burger', price: 10, note: 'Mol go‘shti va kartoshka fri', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80' },
      { key: 'pasta', name: 'Creamy Pasta', price: 9, note: 'Qaymoqli sous bilan', image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80' },
      { key: 'grilled_chicken', name: 'Grilled Chicken', price: 12, note: 'Sabzavot garnish bilan', image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80' },
    ],
  },
  {
    title: 'Ichimliklar',
    items: [
      { key: 'tea', name: 'Choy', price: 2, note: 'Qora yoki ko‘k choy', image: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=900&q=80' },
      { key: 'coffee', name: 'Qahva', price: 3, note: 'Americano yoki cappuccino', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80' },
      { key: 'juice', name: 'Sharbat', price: 3, note: 'Apelsin yoki olma', image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=900&q=80' },
      { key: 'water', name: 'Mineral suv', price: 1.5, note: '0.5L sovutilgan', image: 'https://images.unsplash.com/photo-1616118132534-381148898bb4?auto=format&fit=crop&w=900&q=80' },
    ],
  },
  {
    title: 'Salatlar',
    items: [
      { key: 'caesar', name: 'Caesar Salad', price: 6, note: 'Tovuq va parmesan bilan', image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=900&q=80' },
      { key: 'greek', name: 'Greek Salad', price: 5, note: 'Feta va zaytun bilan', image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80' },
      { key: 'fresh', name: 'Fresh Salad', price: 4.5, note: 'Yengil sabzavotli', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80' },
    ],
  },
  {
    title: 'Desertlar',
    items: [
      { key: 'cake', name: 'Chocolate Cake', price: 4, note: 'Yumshoq shokoladli pirog', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80' },
      { key: 'icecream', name: 'Ice Cream', price: 3.5, note: 'Vanil yoki shokolad', image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80' },
      { key: 'fruit_plate', name: 'Fruit Plate', price: 4.5, note: 'Mavsumiy mevalar', image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=900&q=80' },
    ],
  },
]

export default function RoomServiceMenu({
  roomNumber: initialRoomNumber = '',
  roomOptions = [],
  allowRoomSelection = false,
  title = 'Room Service Menyu',
  successText = 'Buyurtmangiz qabul qilindi! Tez orada yetkazib beriladi.',
  onOrderPlaced,
}) {
  const [msg, setMsg] = useState(null)
  const [quantities, setQuantities] = useState({})
  const [loading, setLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState(initialRoomNumber)
  const [confirmedOrder, setConfirmedOrder] = useState(null)

  const allItems = useMemo(() => MENU.flatMap(section => section.items), [])
  const selectedItems = useMemo(() => (
    allItems
      .filter(item => (quantities[item.key] || 0) > 0)
      .map(item => ({
        ...item,
        quantity: quantities[item.key],
        total: item.price * quantities[item.key],
      }))
  ), [allItems, quantities])

  function setQty(key, value) {
    setQuantities(prev => ({ ...prev, [key]: value || 0 }))
  }

  function changeQty(key, delta) {
    const nextValue = Math.max(0, Math.min(9, (quantities[key] || 0) + delta))
    setQty(key, nextValue)
  }

  function openConfirm() {
    if (allowRoomSelection && !selectedRoom) {
      setMsg({ type: 'error', text: 'Avval xona tanlang.' })
      return
    }
    if (selectedItems.length === 0) {
      setMsg({ type: 'error', text: 'Kamida bitta mahsulot tanlang.' })
      return
    }
    setMsg(null)
    setConfirmedOrder(null)
    setConfirmOpen(true)
  }

  async function placeOrder() {
    const payloadItems = selectedItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
    }))

    if (!selectedRoom) {
      setMsg({ type: 'error', text: 'Xona tanlanmagan.' })
      return
    }

    setMsg(null)
    setLoading(true)
    try {
      const order = await api.post('/room-service/order', {
        room_number: selectedRoom,
        items: payloadItems,
      })
      setMsg(null)
      setConfirmedOrder(order)
      onOrderPlaced?.(order)
    } catch (e) {
      setMsg({ type:'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  const selectedCount = Object.values(quantities).reduce((sum, qty) => sum + (qty || 0), 0)
  const totalPrice = selectedItems.reduce((sum, item) => sum + item.total, 0)

  return (
    <Card
      title={<span><ShoppingCartOutlined className="mr-2" />{title}</span>}
      className="mb-5"
      extra={<Tag color="green">{selectedCount} ta tanlandi</Tag>}
    >
      {msg && <Alert type={msg.type} message={msg.text} showIcon className="mb-4" />}

      {MENU.map(section => (
        <div key={section.title} className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base">{section.title}</h3>
            <span className="text-xs text-gray-500">Mahsulot miqdorini + yoki - bilan tanlang</span>
          </div>
          <Row gutter={[16, 16]}>
            {section.items.map(item => (
              <Col xs={24} sm={12} lg={8} xl={6} key={item.key}>
                <Card
                  hoverable
                  className="h-full overflow-hidden"
                  cover={(
                    <div className="relative">
                      <img src={item.image} alt={item.name} className="h-52 w-full object-cover" />
                      <div
                        className="absolute inset-x-0 bottom-0 h-20"
                        style={{ background:'linear-gradient(180deg, transparent, rgba(0,0,0,0.6))' }}
                      />
                      <div className="absolute bottom-3 left-3 text-white font-semibold text-base">
                        {item.name}
                      </div>
                    </div>
                  )}
                  styles={{ body: { padding: 16 } }}
                >
                  <div className="flex flex-col gap-4 h-full">
                    <div>
                      <div className="text-sm text-gray-500 mb-2">{item.note}</div>
                      <div className="text-lg font-bold">{USD_FORMATTER.format(item.price)}</div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-full border border-gray-200 overflow-hidden">
                        <Button
                          type="text"
                          icon={<MinusOutlined />}
                          onClick={() => changeQty(item.key, -1)}
                          disabled={(quantities[item.key] || 0) === 0}
                        />
                        <div className="min-w-12 text-center font-semibold">{quantities[item.key] || 0}</div>
                        <Button
                          type="text"
                          icon={<PlusOutlined />}
                          onClick={() => changeQty(item.key, 1)}
                          disabled={(quantities[item.key] || 0) >= 9}
                        />
                      </div>

                      <Tag color={(quantities[item.key] || 0) > 0 ? 'blue' : 'default'} className="m-0 px-3 py-1">
                        {(quantities[item.key] || 0) > 0
                          ? USD_FORMATTER.format(item.price * quantities[item.key])
                          : 'Tanlanmagan'}
                      </Tag>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      ))}

      <div
        className="rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        style={{ background:'linear-gradient(135deg,#f5fff8,#eef4ff)', border:'1px solid #dbe7ff' }}
      >
        <div>
          <div className="text-sm text-gray-500">Jami buyurtma summasi</div>
          <div className="text-2xl font-bold">{USD_FORMATTER.format(totalPrice)}</div>
          <div className="text-sm text-gray-500">{selectedCount} ta mahsulot tanlandi</div>
        </div>

        <Button
          type="primary"
          size="large"
          loading={loading}
          onClick={openConfirm}
          style={{ background:'linear-gradient(135deg,#1a7a4a,#2d5be3)', border:'none', minWidth:220 }}
        >
          Buyurtmani tasdiqlash
        </Button>
      </div>

      <Modal
      title={confirmedOrder ? 'Buyurtma qabul qilindi' : 'Buyurtmani tasdiqlang'}
        open={confirmOpen}
        onCancel={() => {
          if (loading) return
          setConfirmOpen(false)
          setConfirmedOrder(null)
          setQuantities({})
        }}
        footer={confirmedOrder
          ? [
            <Button
              key="done"
              type="primary"
              onClick={() => {
                setConfirmOpen(false)
                setConfirmedOrder(null)
                setQuantities({})
              }}
            >
              Yopish
            </Button>,
          ]
          : [
            <Button key="back" onClick={() => setConfirmOpen(false)} disabled={loading}>Bekor qilish</Button>,
            <Button
              key="submit"
              type="primary"
              loading={loading}
              icon={<CheckCircleOutlined />}
              onClick={placeOrder}
            >
              Yuborish
            </Button>,
          ]}
      >
        {confirmedOrder
          ? (
            <div>
              <Alert
                type="success"
                showIcon
                message="Buyurtma qabul qilindi"
                description={`Buyurtma #${confirmedOrder.id} xona ${selectedRoom} uchun qabul qilindi.`}
                className="mb-4"
              />
              <div className="text-sm text-gray-500 mb-2">Jami summa</div>
              <div className="text-xl font-bold">{USD_FORMATTER.format(confirmedOrder.total_price)}</div>
            </div>
          )
          : (
            <>
              {allowRoomSelection && (
                <div className="mb-4">
                  <div className="text-sm font-semibold mb-2">Xona tanlang</div>
                  <Select
                    value={selectedRoom || undefined}
                    onChange={setSelectedRoom}
                    placeholder="Band xonani tanlang"
                    className="w-full"
                    options={roomOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </div>
              )}
              <div className="text-sm text-gray-500 mb-3">
                Xona: <span className="font-semibold text-black">{selectedRoom}</span>
              </div>
              {selectedItems.map(item => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-gray-500">{item.quantity} ta x {USD_FORMATTER.format(item.price)}</div>
                  </div>
                  <div className="font-bold">{USD_FORMATTER.format(item.total)}</div>
                </div>
              ))}
              <Divider className="my-3" />
              <div className="flex items-center justify-between text-base">
                <span>Jami summa</span>
                <span className="font-bold">{USD_FORMATTER.format(totalPrice)}</span>
              </div>
            </>
          )}
      </Modal>
    </Card>
  )
}
