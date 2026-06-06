import MaintenanceWorkspace from '../components/MaintenanceWorkspace'

export default function Maintenance() {
  return (
    <div style={{ background:'#fdf0ff', minHeight:'calc(100vh - 52px)' }}>
      <div className="max-w-5xl mx-auto p-6">
        <MaintenanceWorkspace />
      </div>
    </div>
  )
}
