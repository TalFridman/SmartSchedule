import { useState } from 'react'
import useChatStore from '../store/chatStore'
import useScheduleStore from '../store/scheduleStore'
import { sendChatMessage, fetchScheduleOptions } from '../services/scheduleService'

export default function ChatInput() {
  const [text, setText] = useState('')
  const { addMessage, setTyping, isTyping, messages, pendingSchedule, setPendingSchedule } = useChatStore()
  const { setSchedules, setResultCount, setLoading, setError } = useScheduleStore()

  async function runSchedule(courses, semester) {
    setLoading(true)
    try {
      const { success: ok, data: schedules, missingCourses, error } = await fetchScheduleOptions(courses, semester)
      if (!ok) { setError(error ?? 'שגיאה בטעינת המערכות'); return }

      if (missingCourses.length > 0) {
        const names = missingCourses.map((c) => c.name).join(', ')
        const semesterLabel = { 'א': 'סמסטר א׳', 'ב': 'סמסטר ב׳', 'קיץ': 'סמסטר קיץ' }[semester] ?? semester
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ הקורסים הבאים אינם מופיעים ב${semesterLabel}: ${names}.\nהאם תרצה לראות מערכות שעות ללא קורסים אלה? ענה כן להמשך.`,
          type: 'warning',
          timestamp: Date.now(),
        })
        const availableCodes = courses.filter((code) => !missingCourses.find((m) => m.code === code))
        setPendingSchedule({ courses: availableCodes, semester })
        return
      }

      setPendingSchedule(null)
      setSchedules(schedules)
      setResultCount(schedules.length)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed || isTyping) return

    setText('')

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      type: 'text',
      timestamp: Date.now(),
    })

    setTyping(true)

    try {
      if (pendingSchedule && trimmed === 'כן') {
        await runSchedule(pendingSchedule.courses, pendingSchedule.semester)
        return
      }

      const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }))
      const { success, data: botMsg, meta } = await sendChatMessage(trimmed, conversationHistory)
      if (success) {
        addMessage(botMsg)
        if (meta?.status === 'ready' && meta.parsedCourses?.length > 0) {
          await runSchedule(meta.parsedCourses, meta.semester)
        }
      }
    } finally {
      setTyping(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
      <div className="flex gap-2 items-end">
        <button
          onClick={handleSubmit}
          disabled={isTyping || !text.trim()}
          className="bg-[#d9472b] hover:bg-[#c03d24] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl p-3 transition-colors flex-shrink-0"
          aria-label="שלח"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
        <textarea
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#d9472b] min-h-[52px] max-h-32"
          placeholder="לדוגמה: אני רוצה תקשורת מחשבים ומבני נתונים, ללא יום שישי..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
          rows={1}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1.5 text-right">
        Enter לשליחה • Shift+Enter לשורה חדשה
      </p>
    </div>
  )
}
