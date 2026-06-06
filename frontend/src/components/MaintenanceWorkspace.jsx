import { useEffect, useState } from 'react'
import { Tabs, Card, Button, Alert, Input, Select, Tag, Table, notification, Spin, Modal, Image } from 'antd'
import { ToolOutlined, UnorderedListOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { api, getUser } from '../utils/api'
import { playNotificationSound } from '../hooks/useWebSocket'
import { useWSEvents } from '../hooks/WSContext'
import ImageUpload from './ImageUpload'

const ISSUE_STATUS_LABEL = {
  open: 'Qabul qilindi',
  in_progress: 'Jarayonda',
  resolved: 'Tugatildi',
}

const ISSUE_STATUS_COLOR = {
  open: 'blue',
  in_progress: 'orange',
  resolved: 'green',
}

const ISSUE_ACTION = {
  open: { label: 'Jarayonda', color: '#2d5be3' },
  in_progress: { label: 'Tugatildi', color: '#1a7a4a' },
}

const URGENCY_LABEL = {
  low: 'Past',
  normal: "O'rta",
  high: 'Yuqori',
  critical: 'Kritik',
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function RequestTab({
  isGuest,
  roomNumber,
  staffRoomNumber,
  setStaffRoomNumber,
  roomOptions,
  roomsLoading,
  msg,
  loading,
  issueDescription,
  setIssueDescription,
  issueUrgency,
  setIssueUrgency,
  issueImage,
  setIssueImage,
  onSubmit,
}) {
  return (
    <div style={{ maxWidth: 560 }}>
    <Card className="mb-5">
      {msg && <Alert type={msg.type} message={msg.text} showIcon className="mb-4" />}

      <div
        className="rounded-2xl p-4 md:p-5 mb-5"
        style={{ background: 'linear-gradient(135deg,#fbf5ff,#f3ecff)', border: '1px solid #eadbff' }}
      >
        <div className="text-sm text-gray-500">Nosozlik bildirish</div>
        <div className="text-2xl font-bold mt-1">{isGuest ? `${roomNumber}-xona` : 'Nosozliklar paneli'}</div>
        <div className="text-sm text-gray-500 mt-1">
          {isGuest
            ? "Muammoni yozing, texnik xodim holatni shu sahifada yangilab boradi."
            : "Murojaat yarating va keyingi tablarda statusni bosqichma-bosqich boshqarding."}
        </div>
      </div>

      {!isGuest && (
        <Select
          value={staffRoomNumber || undefined}
          onChange={setStaffRoomNumber}
          className="w-full mb-3"
          placeholder={roomsLoading ? 'Xonalar yuklanmoqda...' : 'Xona tanlang'}
          showSearch
          loading={roomsLoading}
          filterOption={(input, option) => option?.label?.toLowerCase().includes(input.toLowerCase())}
          options={roomOptions}
          notFoundContent={roomsLoading ? <Spin size="small" /> : 'Xona topilmadi'}
        />
      )}

      <Input.TextArea
        rows={5}
        value={issueDescription}
        onChange={event => setIssueDescription(event.target.value)}
        placeholder="Masalan: konditsioner ishlamayapti yoki dushdan suv tomyapti."
        className="mb-3"
      />

      <Select
        value={issueUrgency}
        onChange={setIssueUrgency}
        className="w-full mb-3"
        options={[
          { value: 'low', label: 'Past' },
          { value: 'normal', label: "O'rta" },
          { value: 'high', label: 'Yuqori' },
          { value: 'critical', label: 'Kritik' },
        ]}
      />

      <ImageUpload
        value={issueImage}
        onChange={setIssueImage}
        label="Nosozlik rasmi (ixtiyoriy)"
      />

      <Button
        block
        size="large"
        loading={loading}
        onClick={onSubmit}
        style={{ background: '#7b2fa8', borderColor: '#7b2fa8', color: '#fff' }}
      >
        Xabar yuborish
      </Button>
    </Card>
    </div>
  )
}

const URGENCY_COLOR = { low: 'default', normal: 'blue', high: 'orange', critical: 'red' }

function IssueDetailModal({ issue, open, onClose }) {
  if (!issue) return null

  const steps = [
    { label: 'Qabul qilindi',  key: 'open',        at: issue.created_at,  by: issue.reported_by },
    { label: 'Jarayonda',      key: 'in_progress',  at: null,              by: issue.technician  },
    { label: 'Hal qilindi',    key: 'resolved',     at: issue.resolved_at, by: issue.technician  },
  ]
  const statusOrder = ['open', 'in_progress', 'resolved']
  const currentIdx  = statusOrder.indexOf(issue.status)

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      title={null}
    >
      {/* Header */}
      <div className="mb-5 pr-6">
        <div className="text-xs uppercase tracking-wide text-gray-400">Nosozlik</div>
        <div className="text-2xl font-bold leading-tight mt-1">#{issue.id} — Xona {issue.room_number || issue.room_id}</div>
        <div className="flex items-center gap-2 mt-2">
          <Tag color={ISSUE_STATUS_COLOR[issue.status]}>{ISSUE_STATUS_LABEL[issue.status] || issue.status}</Tag>
          <Tag color={URGENCY_COLOR[issue.urgency]}>{URGENCY_LABEL[issue.urgency] || issue.urgency}</Tag>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Tavsif</div>
          <div className="font-medium mt-1 text-sm">{issue.description}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="text-xs text-gray-500">Mas'ul texnik</div>
          <div className="font-medium mt-1">{issue.technician || '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Bildirgan: {issue.reported_by || '—'}</div>
        </div>
      </div>

      {/* Image */}
      {issue.image_url && (
        <div className="mb-5">
          <div className="text-xs text-gray-500 mb-2">Nosozlik rasmi</div>
          <Image
            src={issue.image_url}
            alt="nosozlik"
            className="rounded-xl border border-gray-200"
            style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Resolution */}
      {issue.status === 'resolved' && (issue.resolution_note || issue.resolution_image_url) && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <div className="text-xs text-green-700 font-semibold mb-2">Tuzatish ma'lumotlari</div>
          {issue.resolution_note && (
            <p className="text-sm text-gray-700 mb-2">{issue.resolution_note}</p>
          )}
          {issue.resolution_image_url && (
            <Image
              src={issue.resolution_image_url}
              alt="tuzatish"
              className="rounded-lg border border-green-200"
              style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'cover' }}
            />
          )}
        </div>
      )}

      {/* Status timeline */}
      <div>
        <div className="font-semibold mb-3">Jarayon holati</div>
        <div className="space-y-2">
          {steps.map((step, idx) => {
            const done = idx <= currentIdx
            return (
              <div key={step.key} className="flex gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex flex-col items-center pt-1">
                  <div className={`h-3 w-3 rounded-full ${done ? 'bg-purple-500' : 'bg-gray-300'}`} />
                  {idx < steps.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-2" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{step.label}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{step.by || 'Hali bajarilmagan'}</div>
                  {step.at && <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(step.at)}</div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

function IssuesTableCard({ title, issues, loading, onRefresh, onAdvanceIssue, updatingId, allowAdvance, emptyText }) {
  const [selectedIssue, setSelectedIssue] = useState(null)
  const columns = [
    { title: '#', dataIndex: 'id', render: value => `#${value}`, width: 60 },
    { title: 'Xona', dataIndex: 'room_number', width: 80 },
    { title: 'Tavsif', dataIndex: 'description' },
    { title: 'Muhimlik', dataIndex: 'urgency', width: 110, render: value => <Tag>{URGENCY_LABEL[value] || value}</Tag> },
    {
      title: 'Holat',
      dataIndex: 'status',
      width: 140,
      render: value => <Tag color={ISSUE_STATUS_COLOR[value]}>{ISSUE_STATUS_LABEL[value] || value}</Tag>,
    },
    { title: "Mas'ul", dataIndex: 'technician', render: value => value || '-' },
    { title: 'Vaqti', dataIndex: 'created_at', render: formatDateTime, width: 180 },
  ]

  if (allowAdvance) {
    columns.push({
      title: 'Amal',
      key: 'action',
      width: 150,
      render: (_, record) => {
        const action = ISSUE_ACTION[record.status]
        if (!action) return null
        return (
          <Button
            type="primary"
            size="small"
            loading={updatingId === record.id}
            onClick={e => { e.stopPropagation(); onAdvanceIssue(record.id, record.status) }}
            style={{ background: action.color, borderColor: action.color }}
          >
            {action.label}
          </Button>
        )
      },
    })
  }

  return (
    <Card className="mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold text-base">{title}</div>
        <Button size="small" onClick={onRefresh} loading={loading}>Yangilash</Button>
      </div>
      <Table
        dataSource={issues}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={false}
        locale={{ emptyText }}
        onRow={record => ({
          onClick: () => setSelectedIssue(record),
          style: { cursor: 'pointer' },
        })}
      />
      <IssueDetailModal
        issue={selectedIssue}
        open={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
    </Card>
  )
}

export default function MaintenanceWorkspace({ isGuest = false }) {
  const { roomNumber } = getUser()
  const [staffRoomNumber, setStaffRoomNumber] = useState('')
  const [roomOptions, setRoomOptions] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [issuesLoading, setIssuesLoading] = useState(true)
  const [issueDescription, setIssueDescription] = useState('')
  const [issueUrgency, setIssueUrgency] = useState('normal')
  const [issueImage, setIssueImage] = useState(null)
  const [activeIssues, setActiveIssues] = useState([])
  const [completedIssues, setCompletedIssues] = useState([])
  const [updatingId, setUpdatingId] = useState(null)
  const [resolveModal, setResolveModal] = useState(null)
  const [resolveNote, setResolveNote] = useState('')
  const [resolveImage, setResolveImage] = useState(null)

  async function loadIssues() {
    setIssuesLoading(true)
    try {
      if (isGuest) {
        const issues = await api.get('/maintenance/my-issues')
        setActiveIssues(issues.filter(issue => issue.status !== 'resolved'))
        setCompletedIssues(issues.filter(issue => issue.status === 'resolved'))
      } else {
        const [active, completed] = await Promise.all([
          api.get('/maintenance/open'),
          api.get('/maintenance/completed'),
        ])
        setActiveIssues(active)
        setCompletedIssues(completed)
      }
      setMsg(null)
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setIssuesLoading(false)
    }
  }

  useEffect(() => {
    loadIssues()
    const t = setInterval(loadIssues, 15000)
    return () => clearInterval(t)
  }, [isGuest])

  useEffect(() => {
    if (isGuest) return
    setRoomsLoading(true)
    api.get('/maintenance/rooms')
      .then(data => {
        setRoomOptions(
          data.map(r => ({ value: r.number, label: `Xona ${r.number} · ${r.floor}-qavat · ${r.room_type}` }))
        )
        setMsg(null)
      })
      .catch(() => {})
      .finally(() => setRoomsLoading(false))
  }, [isGuest])

  useWSEvents({
    _onConnect: loadIssues,
    issue_created: (data) => {
      if (!isGuest) {
        notification.warning({
          message: 'Yangi texnik murojaat',
          description: `Xona ${data.room_number} — ${URGENCY_LABEL[data.urgency] || data.urgency} (${data.technician || 'Belgilanmagan'})`,
          placement: 'topRight',
        })
      }
      loadIssues()
    },
    issue_resolved: (data) => {
      if (isGuest && data.room_number === roomNumber) {
        playNotificationSound()
        notification.success({
          message: 'Muammongiz hal qilindi!',
          description: 'Texnik xizmat xodimi muammoingizni bartaraf etdi.',
          placement: 'topRight',
          duration: 8,
        })
      } else if (!isGuest) {
        notification.success({
          message: 'Murojaat hal qilindi',
          description: `Xona ${data.room_number} — #${data.issue_id}`,
          placement: 'topRight',
        })
      }
      loadIssues()
    },
  })

  async function reportIssue() {
    if (!issueDescription.trim()) {
      setMsg({ type: 'error', text: 'Nosozlik tavsifini kiriting.' })
      return
    }

    if (!isGuest && !staffRoomNumber.trim()) {
      setMsg({ type: 'error', text: 'Xona raqamini kiriting.' })
      return
    }

    setMsg(null)
    setLoading(true)
    try {
      await api.post('/maintenance/report', {
        room_number: isGuest ? roomNumber : staffRoomNumber,
        description: issueDescription,
        urgency: issueUrgency,
        image_url: issueImage,
      })
      setMsg({ type: 'success', text: "Nosozlik bo'yicha xabar yuborildi." })
      setIssueDescription('')
      setIssueUrgency('normal')
      setIssueImage(null)
      if (!isGuest) setStaffRoomNumber('')
      await loadIssues()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  function advanceIssue(issueId, currentStatus) {
    if (currentStatus === 'in_progress') {
      setResolveNote('')
      setResolveImage(null)
      setResolveModal(issueId)
    } else {
      doAdvanceIssue(issueId, null, null)
    }
  }

  async function doAdvanceIssue(issueId, note, imageUrl) {
    setMsg(null)
    setUpdatingId(issueId)
    try {
      const res = await api.post(`/maintenance/issue/${issueId}/advance`, {
        resolution_note: note || null,
        resolution_image_url: imageUrl || null,
      })
      setMsg({ type: 'success', text: res.message })
      setResolveModal(null)
      setResolveNote('')
      setResolveImage(null)
      await loadIssues()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setUpdatingId(null)
    }
  }

  const tabs = [
    {
      key: 'form',
      label: <span><ToolOutlined className="mr-1" />Nosozlik bildirish</span>,
      children: (
        <RequestTab
          isGuest={isGuest}
          roomNumber={roomNumber}
          staffRoomNumber={staffRoomNumber}
          setStaffRoomNumber={setStaffRoomNumber}
          roomOptions={roomOptions}
          roomsLoading={roomsLoading}
          msg={msg}
          loading={loading}
          issueDescription={issueDescription}
          setIssueDescription={setIssueDescription}
          issueUrgency={issueUrgency}
          setIssueUrgency={setIssueUrgency}
          issueImage={issueImage}
          setIssueImage={setIssueImage}
          onSubmit={reportIssue}
        />
      ),
    },
    {
      key: 'active',
      label: <span><UnorderedListOutlined className="mr-1" />Faol holatlar</span>,
      children: (
        <IssuesTableCard
          title={isGuest ? 'Mening faol murojaatlarim' : 'Faol texnik murojaatlar'}
          issues={activeIssues}
          loading={issuesLoading}
          onRefresh={loadIssues}
          onAdvanceIssue={advanceIssue}
          updatingId={updatingId}
          allowAdvance={!isGuest}
          emptyText={isGuest ? "Hozircha faol murojaat yo'q" : "Hozircha faol murojaat yo'q"}
        />
      ),
    },
    {
      key: 'completed',
      label: <span><CheckCircleOutlined className="mr-1" />Tugatilganlar</span>,
      children: (
        <IssuesTableCard
          title={isGuest ? 'Mening tugatilgan murojaatlarim' : 'Tugatilgan texnik murojaatlar'}
          issues={completedIssues}
          loading={issuesLoading}
          onRefresh={loadIssues}
          onAdvanceIssue={advanceIssue}
          updatingId={updatingId}
          allowAdvance={false}
          emptyText={"Hozircha tugatilgan murojaat yo'q"}
        />
      ),
    },
  ]

  return (
    <>
      <Tabs defaultActiveKey="form" size="large" items={tabs} />

      <Modal
        open={!!resolveModal}
        title="Nosozlikni tugatishni tasdiqlang"
        onCancel={() => { setResolveModal(null); setResolveNote(''); setResolveImage(null) }}
        footer={[
          <Button key="cancel" onClick={() => { setResolveModal(null); setResolveNote(''); setResolveImage(null) }}>
            Bekor qilish
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={!!updatingId}
            onClick={() => doAdvanceIssue(resolveModal, resolveNote, resolveImage)}
            style={{ background: '#1a7a4a', borderColor: '#1a7a4a' }}
          >
            Hal qilindi deb belgilash
          </Button>,
        ]}
      >
        <p className="text-gray-500 mb-4 text-sm">
          Muammo hal qilinganligini tasdiqlang. Ixtiyoriy ravishda izoh va rasm qo'shing.
        </p>
        <Input.TextArea
          rows={3}
          placeholder="Tuzatish haqida izoh (ixtiyoriy)"
          value={resolveNote}
          onChange={e => setResolveNote(e.target.value)}
          className="mb-3"
        />
        <ImageUpload
          value={resolveImage}
          onChange={setResolveImage}
          label="Tuzatilgan holat rasmi (ixtiyoriy)"
        />
      </Modal>
    </>
  )
}
