export default function GuestLayout({ children }) {
  return (
    <div className="min-h-screen p-6" style={{ background:'linear-gradient(135deg,#f0fff4,#f0f8ff)' }}>
      <div className="max-w-6xl mx-auto">
        {children}
      </div>
    </div>
  )
}
