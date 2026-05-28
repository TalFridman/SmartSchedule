import ScheduleBlock from './ScheduleBlock'

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי']
const START_HOUR = 8
const END_HOUR = 23
const HOUR_HEIGHT = 80

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export default function ScheduleGrid({ blocks }) {
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT

  // Assign a stable color index per unique course_code
  const courseColorMap = {}
  let nextColor = 0
  blocks.forEach((block) => {
    if (!(block.course_code in courseColorMap)) {
      courseColorMap[block.course_code] = nextColor++
    }
  })

  // Group blocks by day
  const blocksByDay = Object.fromEntries(DAYS.map((d) => [d, []]))
  blocks.forEach((block) => {
    if (block.day in blocksByDay) blocksByDay[block.day].push(block)
  })

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  return (
    <div className="overflow-y-auto max-h-[600px]">
      {/* Day header row */}
      <div className="flex border-b border-gray-200 sticky top-0 bg-white z-10">
        {/* Time label spacer — first in DOM = right side in RTL */}
        <div className="w-12 flex-shrink-0" />
        {/* Day column headers flow right→left in RTL */}
        {DAYS.map((day) => (
          <div
            key={day}
            className="flex-1 text-center text-sm font-medium text-gray-700 py-2 border-e border-gray-100"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex">
        {/* Time labels — first in DOM = right side in RTL */}
        <div className="w-12 flex-shrink-0 relative" style={{ height: totalHeight }}>
          {hours.map((h) => (
            <div
              key={h}
              className="absolute w-full text-right ps-1 text-xs text-[#d9472b] leading-none"
              style={{ top: (h - START_HOUR) * HOUR_HEIGHT + 2 }}
            >
              {h}:00
            </div>
          ))}
        </div>
        {/* Day columns flow right→left in RTL */}
        {DAYS.map((day) => (
          <div
            key={day}
            className="flex-1 relative border-e border-gray-100"
            style={{ height: totalHeight }}
          >
            {/* Horizontal hour lines */}
            {hours.map((h) => (
              <div
                key={h}
                className="absolute w-full border-b border-gray-100"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
              />
            ))}
            {/* Course blocks */}
            {blocksByDay[day].map((block) => {
              const startMins = timeToMinutes(block.start_time)
              const endMins = timeToMinutes(block.end_time)
              const top = ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT
              const height = ((endMins - startMins) / 60) * HOUR_HEIGHT
              return (
                <ScheduleBlock
                  key={block.id}
                  block={block}
                  colorIndex={courseColorMap[block.course_code]}
                  top={top}
                  height={height}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
