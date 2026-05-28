import useScheduleStore from '../store/scheduleStore'
import ScheduleCard from './ScheduleCard'

export default function ScheduleResults() {
  const { schedules, resultCount } = useScheduleStore()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-800 text-right">
          {resultCount} מערכות שעות נמצאו
        </h2>
        <span className="bg-[#d9472b] text-white text-xs px-3 py-1 rounded-full">
          מוצגות {schedules.length} הטובות ביותר
        </span>
      </div>
      {schedules.map((schedule) => (
        <ScheduleCard key={schedule.id} schedule={schedule} />
      ))}
    </div>
  )
}
