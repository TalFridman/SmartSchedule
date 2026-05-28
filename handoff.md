# Handoff — Afeka Schedule Generator

---

## Goal

Build a full-stack **course schedule generator** for Afeka College students.
The student describes their desired courses and constraints in natural language; an AI chatbot extracts the structured data; a DFS backtracking algorithm finds all conflict-free timetable combinations; the results are displayed on a React frontend.

**Stack:** Node.js + TypeScript (Express) backend · Supabase (PostgreSQL) · OpenAI API · React 19 + Vite + Zustand frontend (JSX, plain JS).

---

## Current State

| Layer | Status |
|---|---|
| Database | ✅ Fully seeded — 451 courses, 2 241 groups, 2 597 sessions, 855 prerequisites |
| Backend scaffolding | ✅ Express + TypeScript, CORS configured, global error handler |
| Data types | ✅ `Session`, `Block`, `CourseBlocks`, `PreparedData`, `DayMasks` defined |
| Bitmask engine | ✅ `sessionToBitmask`, `buildDayMasks`, `blocksConflict` — tested & verified |
| Data preparation | ✅ `prepareData(courseCodes[], semester)` — semester-filtered DB queries + MRV sort |
| DFS scheduler | ✅ `findSchedules(data, maxResults?)` — backtracking with early termination |
| Schedule endpoint | ✅ `POST /api/schedule` — returns `Block[][]` + `missingCourses[]` |
| Chat service | ✅ OpenAI Structured Outputs pipeline (4-phase: catalog → prompt → GPT-4o → prereqs) |
| Chat endpoint | ✅ `POST /api/chat` — public (no auth), always responds in Hebrew |
| Course count endpoint | ✅ `GET /api/courses/count` — live Supabase count |
| Frontend components | ✅ Full UI: chat sidebar, schedule grid, schedule cards, warning flow |
| Frontend services | ✅ All real API calls — zero mocks remaining |
| Missing semester flow | ✅ Backend detects missing courses → frontend shows warning + asks confirmation |

The server runs on `http://localhost:3000`. Frontend dev server runs on `http://localhost:5173`.

---

## File Structure

```
backend/src/
├── index.ts                      Express entry, CORS, /health, /api/courses/count
├── lib/supabaseClient.ts         Singleton Supabase client
├── types/schedule.types.ts       Session, Block, CourseBlocks, PreparedData, GroupNode, DayMasks
├── utils/bitmask.ts              sessionToBitmask, buildDayMasks, blocksConflict
├── middleware/auth.middleware.ts  Auth middleware — UNUSED (auth removed for hackathon)
├── services/
│   ├── dataPrep.service.ts       prepareData(courseCodes[], semester) → PreparedData
│   ├── scheduler.service.ts      findSchedules(data, maxResults?) → Block[][]
│   └── chat.service.ts           processChat(message, history) → ChatResponse
└── routes/
    ├── schedule.route.ts         POST /api/schedule
    └── chat.route.ts             POST /api/chat

frontend/src/
├── App.jsx
├── main.jsx
├── lib/supabaseClient.js         Supabase client — UNUSED (auth removed for hackathon)
├── store/
│   ├── chatStore.js              messages, isTyping, courseCount, pendingSchedule
│   └── scheduleStore.js          schedules, resultCount, loading, error
├── services/
│   └── scheduleService.js        sendChatMessage, fetchScheduleOptions, fetchCourseCount
└── components/
    ├── MainLayout.jsx
    ├── AppHeader.jsx
    ├── ChatSidebar.jsx
    ├── ChatHeader.jsx
    ├── ChatInput.jsx             Submit logic, pendingSchedule confirmation flow
    ├── ChatMessages.jsx
    ├── ChatMessage.jsx
    ├── ChatWarningCard.jsx
    ├── EmptyState.jsx
    ├── SchedulePanel.jsx
    ├── ScheduleResults.jsx
    ├── ScheduleCard.jsx
    ├── ScheduleGrid.jsx          Time range 08:00–23:00, 80px/hour
    └── ScheduleBlock.jsx         Shows: course name, code, group number, lecturer, room
```

---

## API Contract

### `POST /api/chat`
**Auth:** None (public)

**Request:**
```json
{
  "message": "אני רוצה סמסטר א, מבני נתונים ותקשורת מחשבים, ללא יום שישי",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "status": "ready" | "clarification_needed",
  "semester": "א" | "ב" | "קיץ" | "",
  "parsedCourses": ["20407", "20465"],
  "constraints": {
    "blockedDays": ["Friday"],
    "preferredTimeRange": { "start": "09:00", "end": "18:00" },
    "maxDaysPerWeek": null
  },
  "botMessage": "מצאתי את הקורסים שביקשת..."
}
```

**Rules enforced by GPT-4o:**
- Always responds in Hebrew (`botMessage`)
- Asks for semester if not mentioned
- Exact-match only — no fuzzy matching, no translation, no guessing
- `status: "ready"` only when ALL courses matched 100%

---

### `POST /api/schedule`
**Auth:** None (public)

**Request:**
```json
{ "courseCodes": ["20407", "20465"], "semester": "א" }
```

**Response:**
```json
{
  "ok": true,
  "coursesLoaded": 2,
  "schedulesFound": 8,
  "missingCourses": [],
  "schedules": [ [ { ...Block }, { ...Block } ], ... ]
}
```

`missingCourses` is populated when a course code exists in the DB but has no groups in the requested semester:
```json
"missingCourses": [{ "code": "20555", "name": "סטטיסטיקה" }]
```

Frontend handles this by showing a warning and asking the user to confirm before re-running without the missing course(s).

---

### `GET /api/courses/count`
Returns `{ "count": 451 }` — live count from Supabase.

---

## Data Flow

```
User types → ChatInput.handleSubmit()
  builds conversationHistory from chatStore.messages
  → sendChatMessage(text, history)
      POST /api/chat  { message, conversationHistory }
      ← { status, semester, parsedCourses, botMessage }
  addMessage(botMsg)           ← always shown
  if meta.status === "ready":
    → fetchScheduleOptions(parsedCourses, semester)
        POST /api/schedule  { courseCodes, semester }
        if missingCourses.length > 0:
          ← show warning message, set pendingSchedule, wait for "כן"
        else:
          ← transformSchedules(Block[][]) → ScheduleOption[]
          setSchedules / setResultCount → SchedulePanel re-renders
  if pendingSchedule && user types "כן":
    → runSchedule(pendingSchedule.courses, pendingSchedule.semester)
```

---

## Environment Variables

### `backend/.env`
```
SUPABASE_URL=https://ljoagpaiztxjhbdvkctw.supabase.co
SUPABASE_ANON_KEY=<anon key>
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
PORT=3000
ALLOWED_ORIGIN=          # optional — production frontend origin
```

### `frontend/.env`
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://ljoagpaiztxjhbdvkctw.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

---

## Running the Project

```bash
# Backend
cd backend
npm run dev        # ts-node-dev with hot reload on :3000

# Frontend
cd frontend
npm run dev        # Vite dev server on :5173
```

---

## Known Limitations (post-hackathon)

| Issue | Location | Fix later |
|---|---|---|
| `type` field (הרצאה/תרגיל/מעבדה) is always `""` | `scheduleService.js → blockToFlatSessions` | Add `type` to backend `Session` shape in `dataPrep.service.ts` |
| `group_number` shows full group ID string, not short suffix | `scheduleService.js → blockToFlatSessions` | Parse suffix: `parentGroupId.split("-")[1]` |
| `constraints` extracted by GPT-4o are not yet applied to DFS | `scheduler.service.ts` | Pass constraints to `findSchedules` and filter results |
| Frontend test suite (`__tests__/`) is stale | `frontend/src/__tests__/` | Update `chatStore.test.js` and `scheduleStore.test.js` to reflect real API shapes |
| `auth.middleware.ts` and `supabaseClient.js` (frontend) are unused dead code | Both files | Delete before production deploy |
| No production auth | Entire app | Re-enable Supabase Auth when moving beyond hackathon |

---

## Failed Attempts (Historical)

| What | Why it failed | Fix applied |
|---|---|---|
| `import_to_supabase.py` FK violation | 2 child groups referenced missing parent IDs | Added orphan-guard; skip + log missing parents |
| Same script on Windows | `UnicodeEncodeError` on emoji in `print()` | Replaced all emoji with plain ASCII |
| Supabase JS join type mismatch | `courses(course_name)` returns array not object | `Array.isArray` guard in `dataPrep.service.ts` |
| `POST /api/chat` 500 error | Query used `prerequisite_code` column (doesn't exist) | Correct column is `req_course_name` in `prerequisites` table |
| Bot responded in English | System prompt had no language enforcement | Added `LANGUAGE RULE — ABSOLUTE` to system prompt |
| Frontend showed 80 courses | `courseCount: 80` hardcoded in `chatStore.js` | `ChatSidebar` calls `fetchCourseCount()` on mount |
