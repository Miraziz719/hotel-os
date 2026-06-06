import RoomServiceWorkspace from '../components/RoomServiceWorkspace'

export default function RoomService() {
  return (
    <div style={{ background:'#fff8f0', minHeight:'calc(100vh - 52px)' }}>
      <div className="max-w-5xl mx-auto p-6">
        <RoomServiceWorkspace />
      </div>
    </div>
  )
}
