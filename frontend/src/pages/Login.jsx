import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Form, Input, Button, Card, Alert, Tag } from 'antd'
import { UserOutlined, LockOutlined, RightOutlined } from '@ant-design/icons'
import { api, saveAuth, getUser } from '../utils/api'

const ROLE_HOME = {
  admin: '/admin', reception: '/reception', housekeeping: '/room-service',
  room_service: '/kitchen', maintenance: '/problems', guest: '/guest-kitchen',
}

const TEST_CREDS = [
  { role: 'Admin',        color: '#f59e0b', user: 'admin',        pass: 'admin'        },
  { role: 'Reception',    color: '#3b82f6', user: 'reception',    pass: 'reception'    },
  { role: 'Room Service', color: '#10b981', user: 'cleaner1',    pass: 'cleaner1'    },
  { role: 'Kitchen',      color: '#f97316', user: 'kitchen',     pass: 'kitchen'     },
  { role: 'Problems',     color: '#8b5cf6', user: 'technician1', pass: 'technician1' },
  { role: 'Guest',        color: '#ec4899', user: '+998901112233',pass: '2233'         },
]

export default function Login() {
  const [form]    = Form.useForm()
  const navigate  = useNavigate()
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const { token, role } = getUser()
  if (token && role) {
    return <Navigate to={ROLE_HOME[role] || '/admin'} replace />
  }

  function fillCred(user, pass) {
    form.setFieldsValue({ username: user, password: pass })
  }

  async function onFinish({ username, password }) {
    setError('')
    setLoading(true)
    try {
      const data = await api.post('/auth/login', { username, password })
      saveAuth(data)
      navigate(ROLE_HOME[data.role] || '/')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center gap-6 p-6"
         style={{ background: '#1a1f2e' }}>

      {/* Test credentials panel */}
      <div className="w-64 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <Tag color="gold" className="font-bold text-xs">TEST REJIMI</Tag>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3"
           style={{ color: 'rgba(255,255,255,0.4)' }}>Tezkor kirish</p>
        <div className="flex flex-col gap-2">
          {TEST_CREDS.map(c => (
            <button
              key={c.user}
              onClick={() => fillCred(c.user, c.pass)}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all cursor-pointer text-left w-full"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: c.color }} />
                <div>
                  <div className="text-white font-semibold text-xs">{c.role}</div>
                  <div className="font-mono text-xs" style={{ color:'rgba(255,255,255,0.45)' }}>{c.user}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs" style={{ color:'rgba(255,255,255,0.3)' }}>{c.pass}</span>
                <RightOutlined style={{ color:'rgba(255,255,255,0.2)', fontSize:10 }} />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Login card */}
      <Card className="w-96 shadow-2xl overflow-hidden" styles={{ body: { padding: 0 } }}>
        <div className="py-8 px-8 text-center text-white"
             style={{ background: 'linear-gradient(135deg,#2d5be3,#1a3a9e)' }}>
          <h1 className="text-3xl font-extrabold tracking-tight">HotelOS</h1>
          <p className="text-sm mt-1 opacity-75">Hotel boshqaruv tizimi</p>
        </div>

        <div className="p-8">
          {error && <Alert message={error} type="error" showIcon className="mb-5" />}

          <Form form={form} onFinish={onFinish} layout="vertical" size="large">
            <Form.Item name="username" label="Username yoki telefon raqami"
                       rules={[{ required: true, message: 'Majburiy maydon' }]}>
              <Input prefix={<UserOutlined />} placeholder="reception1 yoki +998..." />
            </Form.Item>
            <Form.Item name="password" label="Parol"
                       extra={<span className="text-xs text-gray-400">Mehmonlar: telefon oxirgi 4 raqami</span>}
                       rules={[{ required: true, message: 'Majburiy maydon' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="••••••••" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}
                    size="large" className="mt-1 h-11 font-bold">
              Tizimga kirish
            </Button>
          </Form>
        </div>
      </Card>
    </div>
  )
}
