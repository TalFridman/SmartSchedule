import useScheduleStore from '../store/scheduleStore'
import EmptyState from './EmptyState'
import ScheduleResults from './ScheduleResults'

export default function SchedulePanel() {
  const { schedules, loading } = useScheduleStore()

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        טוען...
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {schedules.length === 0 ? <EmptyState /> : <ScheduleResults />}
    </div>
  )
}
