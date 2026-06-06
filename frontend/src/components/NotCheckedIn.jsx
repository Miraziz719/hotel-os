import { Result } from 'antd'
import { HomeOutlined } from '@ant-design/icons'

/**
 * Shown to a guest who is logged in but has no active booking (not checked in).
 * They can browse the app but cannot use any room services until check-in.
 */
export default function NotCheckedIn() {
  return (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <Result
        icon={<HomeOutlined style={{ color: '#2d5be3' }} />}
        title="Siz hali check-in qilmagansiz"
        subTitle="Xizmatlardan foydalanish uchun avval receptsiyada check-in qiling. Check-in qilingach, bu yerda buyurtma va so'rovlar bera olasiz."
      />
    </div>
  )
}
