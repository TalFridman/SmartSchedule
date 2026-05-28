import { useEffect } from 'react'
import useChatStore from '../store/chatStore'
import ChatHeader from './ChatHeader'
import ChatMessages from './ChatMessages'
import ChatInput from './ChatInput'
import { fetchCourseCount } from '../services/scheduleService'

export default function ChatSidebar() {
  const { addMessage, setCourseCount } = useChatStore()

  // Seed the initial greeting messages once on mount and fetch real course count
  useEffect(() => {
    fetchCourseCount().then(({ data }) => setCourseCount(data))

    const { messages } = useChatStore.getState()
    if (messages.length > 0) return
    addMessage({
      id: 'greeting-1',
      role: 'assistant',
      content: 'שלום! אני Smart Schedule – מחולל מערכת השעות החכם של אפקה 🎓',
      type: 'text',
      timestamp: Date.now(),
    })
    addMessage({
      id: 'greeting-2',
      role: 'assistant',
      content: 'ספר לי באיזה סמסטר אתה רוצה ללמוד (א׳, ב׳ או קיץ), אילו קורסים אתה רוצה, ואם יש הגבלות (ימים פנויים, שעות מועדפות).',
      type: 'text',
      timestamp: Date.now() + 1,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-96 flex flex-col bg-white border-s border-gray-200 h-full flex-shrink-0">
      <ChatHeader />
      <ChatMessages />
      <ChatInput />
    </div>
  )
}
