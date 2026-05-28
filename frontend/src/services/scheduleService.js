const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const DAY_MAP = {
  'א': 'ראשון',
  'ב': 'שני',
  'ג': 'שלישי',
  'ד': 'רביעי',
  'ה': 'חמישי',
  'ו': 'שישי',
}

function getSession() {
  return 'hackathon-no-auth'
}

function blockToFlatSessions(block, blockIndex) {
  return block.sessions.map((session, sessionIndex) => ({
    id: `${block.blockId}_${sessionIndex}`,
    course_code: block.courseCode,
    course_name: block.courseName,
    group_number: block.parentGroupId,
    lecturer: block.lecturer ?? '',
    day: DAY_MAP[session.day] ?? session.day,
    start_time: session.startTime,
    end_time: session.endTime,
    room: session.room ?? '',
    type: '',
  }))
}

function transformSchedules(backendSchedules) {
  return backendSchedules.map((blocks, i) => ({
    id: `opt_${i}`,
    option_number: i + 1,
    is_recommended: i === 0,
    session_count: blocks.length,
    blocks: blocks.flatMap((block, bi) => blockToFlatSessions(block, bi)),
  }))
}

export async function sendChatMessage(text, conversationHistory = []) {
  try {
    const token = await getSession()
    const response = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: text, conversationHistory }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      return { success: false, data: null, error: err.error ?? response.statusText }
    }

    const { status, semester, parsedCourses, botMessage } = await response.json()

    return {
      success: true,
      data: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: botMessage,
        type: status === 'clarification_needed' ? 'warning' : 'text',
        timestamp: Date.now(),
      },
      meta: { status, semester, parsedCourses },
    }
  } catch (err) {
    return { success: false, data: null, error: err.message }
  }
}

export async function fetchScheduleOptions(parsedCourses, semester) {
  try {
    const response = await fetch(`${API_URL}/api/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseCodes: parsedCourses, semester }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      return { success: false, data: null, error: err.error ?? response.statusText }
    }

    const { schedules, missingCourses } = await response.json()
    return { success: true, data: transformSchedules(schedules), missingCourses: missingCourses ?? [] }
  } catch (err) {
    return { success: false, data: null, error: err.message }
  }
}

export async function fetchCourseCount() {
  try {
    const response = await fetch(`${API_URL}/api/courses/count`)
    if (!response.ok) return { success: false, data: 0 }
    const { count } = await response.json()
    return { success: true, data: count }
  } catch {
    return { success: false, data: 0 }
  }
}
