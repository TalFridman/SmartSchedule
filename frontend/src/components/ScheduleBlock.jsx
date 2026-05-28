const BLOCK_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-600',
  'bg-yellow-600',
  'bg-pink-600',
]

export default function ScheduleBlock({ block, colorIndex, top, height }) {
  const colorClass = BLOCK_COLORS[colorIndex % BLOCK_COLORS.length]

  return (
    <div
      className={`absolute inset-x-0.5 rounded-md px-1.5 py-1 text-white text-xs overflow-hidden ${colorClass}`}
      style={{ top, height }}
      title={[block.course_name, `${block.course_code} | קבוצה ${block.group_number}`, block.lecturer, block.room].filter(Boolean).join('\n')}
    >
      <div className="font-medium truncate leading-tight">{block.course_name}</div>
      <div className="opacity-90 truncate leading-tight" style={{ fontSize: '10px' }}>{block.course_code} | קבוצה {block.group_number}</div>
      {block.lecturer && <div className="opacity-80 truncate" style={{ fontSize: '10px' }}>{block.lecturer}</div>}
      {block.room && <div className="opacity-80 truncate" style={{ fontSize: '10px' }}>{block.room}</div>}
    </div>
  )
}
