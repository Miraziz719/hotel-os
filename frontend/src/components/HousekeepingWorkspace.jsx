import { useEffect, useMemo, useState } from 'react'
import { Tabs, Card, Button, Alert, Tag, Table, notification, Modal, Image, Input } from 'antd'
import { CheckCircleOutlined, ClockCircleOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { api, getUser } from '../utils/api'
import { playNotificationSound } from '../hooks/useWebSocket'
import { useWSEvents } from '../hooks/WSContext'
import ImageUpload from './ImageUpload'

const ROOM_STATUS_LABEL = {
  clean: 'Toza',
  dirty: 'Tozalanishi kerak',
  cleaning: 'Tozalanmoqda',
  maintenance: 'Texnik xizmatda',
  occupied: 'Band',
}

const ACTIVE_STATUS_COLOR = {
  dirty: 'warning',
  cleaning: 'processing',
  occupied: 'default',
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function RequestTab({ isGuest, roomNumber, status, msg, loading, statusLoading, onRequestCleaning, onRefresh }) {
  const requestStatus = useMemo(() => {
    if (!status) return { label: 'Yuklanmoqda', color: 'default' }
    if (status.room_status === 'cleaning') return { label: 'Tozalanmoqda', color: 'processing' }
    if (status.in_queue) return { label: 'Navbatda', color: 'warning' }
    if (status.room_status === 'clean') return { label: 'Tozalangan', color: 'success' }
    return { label: ROOM_STATUS_LABEL[status.room_status] || status.room_status, color: 'default' }
  }, [status])

  return (
    <Card className="mb-5">
      {msg && <Alert type={msg.type} message={msg.text} showIcon className="mb-4" />}

      <div
        className="rounded-2xl p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5"
        style={{ background: 'linear-gradient(135deg,#f5fff8,#eef4ff)', border: '1px solid #dbe7ff' }}
      >
        <div>
          <div className="text-sm text-gray-500">{isGuest ? "Xonani tozalash so'rovi" : 'Tozalash xizmati'}</div>
          <div className="text-2xl font-bold mt-1">{isGuest ? `${roomNumber}-xona` : 'Housekeeping panel'}</div>
          <div className="text-sm text-gray-500 mt-1">
            {isGuest
              ? "Housekeeping jamoasi navbat asosida xizmat ko'rsatadi."
              : "Faol tozalash ishlarini keyingi tab orqali boshqaring."}
          </div>
        </div>
        {isGuest && (
          <Button
            type="primary"
            size="large"
            loading={loading}
            onClick={onRequestCleaning}
            style={{ background: 'linear-gradient(135deg,#1a7a4a,#2d5be3)', border: 'none', minWidth: 220 }}
          >
            Tozalashni chaqirish
          </Button>
        )}
      </div>

      <Card
        size="small"
        title={isGuest ? "So'rov holati" : 'Joriy holat'}
        extra={<Button size="small" onClick={onRefresh} loading={statusLoading}>Yangilash</Button>}
      >
        {!status ? (
          <div className="text-gray-400 py-4">Holat yuklanmoqda...</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-500">Joriy holat</div>
                  <div className="font-semibold mt-1">{requestStatus.label}</div>
                </div>
                <Tag color={requestStatus.color}>{requestStatus.label}</Tag>
              </div>
              <div className="text-xs text-gray-500 mt-3">
                Xona holati: {ROOM_STATUS_LABEL[status.room_status] || status.room_status}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">Navbat ma'lumoti</div>
              <div className="font-semibold mt-1">
                {status.in_queue ? `${status.queue_position}-o'rin` : 'Navbatda emas'}
              </div>
              <div className="text-xs text-gray-500 mt-3">Jami navbat: {status.queue_size}</div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="text-xs text-gray-500">Oxirgi tozalagan</div>
              <div className="font-semibold mt-1">{status.cleaned_by || '-'}</div>
              <div className="text-xs text-gray-500 mt-3">{formatDateTime(status.last_cleaned_at)}</div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {status.room_status === 'cleaning' ? <ClockCircleOutlined /> : <CheckCircleOutlined />}
                {status.room_status === 'cleaning' ? 'Xona ustida ish ketmoqda' : 'Xona holati kuzatilmoqda'}
              </div>
              <div className="text-xs text-gray-500 mt-3">
                {isGuest
                  ? "So'rov yuborilgandan keyin holat shu yerda yangilanadi."
                  : "Start va Tugatildi tugmalari orqali status bosqichma-bosqich yuradi."}
              </div>
            </div>
          </div>
        )}
      </Card>
    </Card>
  )
}

function taskStatusTag(record) {
  if (record.room_status === 'cleaning') return <Tag color="processing">Tozalanmoqda</Tag>
  if (record.in_queue) return <Tag color="warning">Kutilmoqda</Tag>
  if (record.room_status === 'clean') return <Tag color="success">Toza</Tag>
  return <Tag color={ACTIVE_STATUS_COLOR[record.room_status]}>{ROOM_STATUS_LABEL[record.room_status] || record.room_status}</Tag>
}

function TaskDetailModal({ task, open, onClose }) {
  if (!task) return null

  const steps = [
    {
      label: 'Navbatga qo\'shildi',
      done: task.in_queue || task.room_status === 'cleaning' || task.room_status === 'clean',
      info: task.queue_position ? `${task.queue_position}-o'rin` : null,
    },
    {
      label: 'Tozalash boshlandi',
      done: task.room_status === 'cleaning' || task.room_status === 'clean',
      info: null,
    },
    {
      label: 'Tozalash tugallandi',
      done: task.room_status === 'clean',
      info: task.cleaned_by || null,
      at: task.last_cleaned_at,
    },
  ]

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={null} width={520}>
      {/* Header */}
      <div className="mb-5 pr-6">
        <div className="text-xs uppercase tracking-wide text-gray-400">Xona</div>
        <div className="text-2xl font-bold mt-1">Xona {task.room_number}</div>
        <div className="mt-2">{taskStatusTag(task)}</div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Navbat o'rni</div>
          <div className="font-medium mt-1">{task.queue_position ? `${task.queue_position}-o'rin` : '—'}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Oxirgi tozalaган</div>
          <div className="font-medium mt-1">{task.cleaned_by || '—'}</div>
          <div className="text-xs text-gray-400 mt-1">{formatDateTime(task.last_cleaned_at)}</div>
        </div>
      </div>

      {/* Clean note + image */}
      {(task.last_clean_note || task.last_clean_image_url) && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="text-xs text-green-700 font-semibold mb-2">Tozalash ma'lumotlari</div>
          {task.last_clean_note && (
            <p className="text-sm text-gray-700 mb-2">"{task.last_clean_note}"</p>
          )}
          {task.last_clean_image_url && (
            <Image
              src={task.last_clean_image_url}
              alt="tozalash"
              className="rounded-xl border border-green-200"
              style={{ maxWidth: '100%', maxHeight: 240, objectFit: 'cover' }}
            />
          )}
        </div>
      )}

      {/* Timeline */}
      <div>
        <div className="font-semibold mb-3">Jarayon holati</div>
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={step.label} className="flex gap-3 rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex flex-col items-center pt-1">
                <div className={`h-3 w-3 rounded-full flex-shrink-0 ${step.done ? 'bg-green-500' : 'bg-gray-300'}`} />
                {idx < steps.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-2" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">{step.label}</div>
                {step.info && <div className="text-sm text-gray-500 mt-0.5">{step.info}</div>}
                {step.at && <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(step.at)}</div>}
                {!step.done && <div className="text-sm text-gray-400 mt-0.5">Hali bajarilmagan</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

function TasksTableCard({ title, tasks, loading, onRefresh, onAdvanceTask, updatingRoom, allowAdvance, emptyText }) {
  const [selectedTask, setSelectedTask] = useState(null)

  const columns = [
    { title: 'Xona', dataIndex: 'room_number', width: 90 },
    {
      title: 'Holat',
      width: 150,
      render: (_, record) => taskStatusTag(record),
    },
    {
      title: 'Navbat',
      dataIndex: 'queue_position',
      width: 110,
      render: value => (value ? `${value}-o'rin` : '-'),
    },
    { title: 'Kim bajargan', dataIndex: 'cleaned_by', render: value => value || '-' },
    { title: "So'nggi vaqt", dataIndex: 'last_cleaned_at', render: formatDateTime, width: 190 },
  ]

  if (allowAdvance) {
    columns.push({
      title: 'Amal',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          loading={updatingRoom === record.room_number}
          onClick={e => { e.stopPropagation(); onAdvanceTask(record) }}
          style={{
            background: record.room_status === 'cleaning' ? '#1a7a4a' : '#2d5be3',
            borderColor: record.room_status === 'cleaning' ? '#1a7a4a' : '#2d5be3',
          }}
        >
          {record.room_status === 'cleaning' ? 'Tugatildi' : 'Boshlash'}
        </Button>
      ),
    })
  }

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-base">{title}</div>
        <Button size="small" onClick={onRefresh} loading={loading}>Yangilash</Button>
      </div>
      <Table
        dataSource={tasks}
        columns={columns}
        rowKey={record => `${record.room_number}-${record.last_cleaned_at || record.room_status}`}
        size="small"
        pagination={false}
        locale={{ emptyText }}
        onRow={record => ({
          onClick: () => setSelectedTask(record),
          style: { cursor: 'pointer' },
        })}
      />
      <TaskDetailModal task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
    </Card>
  )
}

export default function HousekeepingWorkspace({ isGuest = false }) {
  const { roomNumber } = getUser()
  const [status, setStatus] = useState(null)
  const [activeTasks, setActiveTasks] = useState([])
  const [completedTasks, setCompletedTasks] = useState([])
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(true)
  const [updatingRoom, setUpdatingRoom] = useState(null)
  const [completeModal, setCompleteModal] = useState(null)
  const [cleanImage, setCleanImage] = useState(null)
  const [cleanNote, setCleanNote] = useState('')

  async function loadData() {
    setStatusLoading(true)
    try {
      if (isGuest) {
        const guestStatus = await api.get('/housekeeping/my-status')
        setStatus(guestStatus)
        setActiveTasks(guestStatus.in_queue || guestStatus.room_status === 'cleaning' ? [guestStatus] : [])
        setCompletedTasks(guestStatus.last_cleaned_at || guestStatus.cleaned_by ? [guestStatus] : [])
      } else {
        const [active, completed, queue] = await Promise.all([
          api.get('/housekeeping/active-tasks'),
          api.get('/housekeeping/completed-tasks'),
          api.get('/housekeeping/queue'),
        ])

        setActiveTasks(active)
        setCompletedTasks(completed)
        setStatus({
          room_status: active.find(task => task.room_status === 'cleaning')?.room_status || 'clean',
          in_queue: (queue.cleaning_queue || []).length > 0,
          queue_position: active[0]?.queue_position || null,
          queue_size: (queue.cleaning_queue || []).length,
          cleaned_by: completed[0]?.cleaned_by || null,
          last_cleaned_at: completed[0]?.last_cleaned_at || null,
        })
      }
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 15000)
    return () => clearInterval(t)
  }, [isGuest])

  useWSEvents({
    _onConnect: loadData,
    room_status_changed: (data) => {
      const label = (s) => ROOM_STATUS_LABEL[s] || s
      if (isGuest && data.room_number === roomNumber && data.new_status === 'clean') {
        playNotificationSound()
        notification.success({
          message: 'Xonangiz tozalandi!',
          description: 'Housekeeping jamoasi xonangizni tozalab chiqdi.',
          placement: 'topRight',
          duration: 8,
        })
      } else if (!isGuest) {
        notification.info({
          message: `Xona ${data.room_number} holati o'zgardi`,
          description: `${label(data.old_status)} → ${label(data.new_status)}`,
          placement: 'topRight',
        })
      }
      loadData()
    },
    housekeeping_requested: (data) => {
      if (!isGuest) {
        notification.info({
          message: "Tozalash so'rovi",
          description: `Xona ${data.room_number} — ${data.requested_by}`,
          placement: 'topRight',
        })
      }
      loadData()
    },
  })

  async function requestCleaning() {
    setMsg(null)
    setLoading(true)
    try {
      const res = await api.post('/housekeeping/request-cleaning', { room_number: roomNumber })
      setMsg({ type: 'success', text: res.message })
      await loadData()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  function advanceTask(task) {
    if (task.room_status === 'cleaning') {
      setCleanImage(null)
      setCleanNote('')
      setCompleteModal(task)
    } else {
      doAdvanceTask(task, null, null)
    }
  }

  async function doAdvanceTask(task, imageUrl, note) {
    setMsg(null)
    setUpdatingRoom(task.room_number)
    try {
      const endpoint = task.room_status === 'cleaning'
        ? '/housekeeping/complete-cleaning'
        : '/housekeeping/start-cleaning'
      const res = await api.post(endpoint, {
        room_number: task.room_number,
        image_url: imageUrl ?? null,
        note: note || null,
      })
      setMsg({ type: 'success', text: res.message })
      setCompleteModal(null)
      setCleanImage(null)
      setCleanNote('')
      await loadData()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setUpdatingRoom(null)
    }
  }

  const tabs = [
    {
      key: 'request',
      label: <span><ClockCircleOutlined className="mr-1" />Tozalash</span>,
      children: (
        <RequestTab
          isGuest={isGuest}
          roomNumber={roomNumber}
          status={status}
          msg={msg}
          loading={loading}
          statusLoading={statusLoading}
          onRequestCleaning={requestCleaning}
          onRefresh={loadData}
        />
      ),
    },
    {
      key: 'active',
      label: <span><UnorderedListOutlined className="mr-1" />Faol holatlar</span>,
      children: (
        <TasksTableCard
          title={isGuest ? "Mening faol tozalash holatlarim" : 'Faol tozalash ishlari'}
          tasks={activeTasks}
          loading={statusLoading}
          onRefresh={loadData}
          onAdvanceTask={advanceTask}
          updatingRoom={updatingRoom}
          allowAdvance={!isGuest}
          emptyText={isGuest ? "Hozircha faol so'rov yo'q" : "Hozircha faol ish yo'q"}
        />
      ),
    },
    {
      key: 'completed',
      label: <span><CheckCircleOutlined className="mr-1" />Tugatilganlar</span>,
      children: (
        <TasksTableCard
          title={isGuest ? 'Mening bajarilgan tozalashlarim' : 'Bajarilgan tozalash ishlari'}
          tasks={completedTasks}
          loading={statusLoading}
          onRefresh={loadData}
          onAdvanceTask={advanceTask}
          updatingRoom={updatingRoom}
          allowAdvance={false}
          emptyText={"Hozircha tugatilgan ish yo'q"}
        />
      ),
    },
  ]

  return (
    <>
      <Tabs defaultActiveKey="request" size="large" items={tabs} />

      <Modal
        open={!!completeModal}
        title={`Xona ${completeModal?.room_number} — tozalash tugallandi`}
        onCancel={() => { setCompleteModal(null); setCleanImage(null); setCleanNote('') }}
        footer={[
          <Button key="cancel" onClick={() => { setCompleteModal(null); setCleanImage(null); setCleanNote('') }}>
            Bekor qilish
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={!!updatingRoom}
            onClick={() => doAdvanceTask(completeModal, cleanImage, cleanNote)}
            style={{ background: '#1a7a4a', borderColor: '#1a7a4a' }}
          >
            Tugatildi deb belgilash
          </Button>,
        ]}
      >
        <p className="text-gray-500 mb-3 text-sm">
          Tozalanganligini tasdiqlang. Ixtiyoriy ravishda izoh va rasm qo'shing.
        </p>
        <Input.TextArea
          rows={2}
          placeholder="Izoh (ixtiyoriy)"
          value={cleanNote}
          onChange={e => setCleanNote(e.target.value)}
          className="mb-3"
        />
        <ImageUpload
          value={cleanImage}
          onChange={setCleanImage}
          label="Tozalangan xona rasmi (ixtiyoriy)"
        />
      </Modal>
    </>
  )
}
