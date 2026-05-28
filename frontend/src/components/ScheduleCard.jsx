import ScheduleGrid from './ScheduleGrid'

export default function ScheduleCard({ schedule }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200">
      <div className="bg-[#d9472b] text-white px-5 py-3 flex items-center gap-3">
        <span className="text-base font-semibold">
          ★ אפשרות {schedule.option_number}
        </span>
        {schedule.is_recommended && (
          <span className="bg-white text-[#d9472b] text-xs px-2 py-0.5 rounded-full font-medium">
            המלצה
          </span>
        )}
      </div>
      <div className="px-5 py-2 text-sm text-gray-500 border-b border-gray-100 text-right">
        {schedule.session_count} שיעורים
      </div>
      <ScheduleGrid blocks={schedule.blocks} />
    </div>
  )
}
