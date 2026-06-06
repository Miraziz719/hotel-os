import { useState } from 'react'
import { Upload, Button, Image } from 'antd'
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons'
import { getToken } from '../utils/api'

export default function ImageUpload({ value, onChange, label = "Rasm yuklash" }) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload({ file }) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Yuklashda xato')
      }
      const data = await res.json()
      onChange(data.url)
    } catch (e) {
      alert(e.message)
    } finally {
      setUploading(false)
    }
  }

  if (value) {
    return (
      <div className="mb-3">
        <div className="text-xs text-gray-500 mb-1">{label}</div>
        <div className="relative inline-block">
          <Image
            src={value}
            alt="uploaded"
            width={200}
            className="rounded-lg border border-gray-200"
            style={{ objectFit: 'cover', maxHeight: 140 }}
          />
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onChange(null)}
            className="mt-2"
            style={{ display: 'block' }}
          >
            Rasmni olib tashlash
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-3">
      <Upload
        accept="image/*"
        showUploadList={false}
        customRequest={handleUpload}
        disabled={uploading}
      >
        <Button
          icon={<CameraOutlined />}
          loading={uploading}
          style={{ width: '100%' }}
        >
          {uploading ? 'Yuklanmoqda...' : label}
        </Button>
      </Upload>
    </div>
  )
}
