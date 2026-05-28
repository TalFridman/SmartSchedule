import useChatStore from '../store/chatStore'

export default function ChatHeader() {
  const { courseCount } = useChatStore()

  return (
    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
      {/* RTL: first in DOM = right side */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-base font-bold text-gray-900 text-right">Smart Schedule – עוזר לוח שעות</span>
      </div>
      {/* RTL: last in DOM = left side */}
      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
        {courseCount} קורסים במאגר
      </span>
    </div>
  )
}
