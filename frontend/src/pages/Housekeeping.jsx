import HousekeepingWorkspace from '../components/HousekeepingWorkspace'

export default function Housekeeping() {
  return (
    <div style={{ background:'#f0fff4', minHeight:'calc(100vh - 52px)' }}>
      <div className="max-w-5xl mx-auto p-6">
        <HousekeepingWorkspace />
      </div>
    </div>
  )
}
