# API Contract — Afeka Schedule Generator

Base URL (local dev): `http://localhost:3000`

---

## Authentication

Protected endpoints require a valid **Supabase session JWT** sent as a Bearer token.

```
Authorization: Bearer <supabase_access_token>
```

Obtain the token on the frontend:
```ts
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;
```

If the token is missing, malformed, or expired the server responds:
```json
// HTTP 401
{ "error": "Invalid or expired token." }
```

---

## Endpoints

### `GET /health`

Health check. No auth required.

**Response `200`**
```json
{ "ok": true }
```

---

### `POST /api/chat` 🔒 _requires auth_

Natural-language scheduling assistant. Interprets the user's message, matches courses to the Supabase catalog, extracts constraints, and returns a structured JSON object ready to feed into the schedule generator.

**Request headers**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Request body**
```jsonc
{
  "message": "I want מבני נתונים and no classes on Sunday",  // required, max 1 000 chars
  "conversationHistory": [                                    // optional, max 20 turns
    { "role": "user",      "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `message` | `string` | ✅ | The user's latest message. Max 1 000 characters. |
| `conversationHistory` | `array` | ❌ | Previous turns for multi-turn context. Each entry: `{ role: "user"\|"assistant", content: string }`. Max 20 entries. |

**Response `200`**
```jsonc
{
  "ok": true,
  "status": "ready",                    // "ready" | "clarification_needed"
  "parsedCourses": ["20407"],           // course codes from the Supabase catalog
  "constraints": {
    "blockedDays": ["Sunday"],          // English day names
    "preferredTimeRange": {             // null fields when not mentioned
      "start": "09:00",                 // HH:MM 24-hour
      "end":   "18:00"
    },
    "maxDaysPerWeek": 3                 // 0 = not specified
  },
  "botMessage": "Got it! I found מבני נתונים (20407). ..."
}
```

**Status semantics — critical for frontend logic:**

| `status` | Meaning | Frontend action |
|---|---|---|
| `"ready"` | All courses confidently matched; `parsedCourses` is complete | Enable "Generate Schedule" button; pass `parsedCourses` to `POST /api/schedule` |
| `"clarification_needed"` | One or more course names were ambiguous or not found | Show `botMessage` to the user; do NOT call `/api/schedule` yet |

> ⚠️ **The course catalog is in Hebrew.** Users should type course names in Hebrew or use the course code directly. The model will set `status: "clarification_needed"` for unrecognised names rather than guessing.

**Validation error `400`**
```json
{ "error": "message must be a non-empty string." }
```
Possible error strings:
- `"message must be a non-empty string."`
- `"message must be 1 000 characters or fewer."`
- `"conversationHistory must be an array."`
- `"conversationHistory may not exceed 20 turns."`
- `"Each conversationHistory entry must have role (\"user\"|\"assistant\") and content (string)."`

**Auth error `401`**
```json
{ "error": "Invalid or expired token." }
```

**Server error `500`**
```json
{ "error": "..." }
```

---

### `POST /api/schedule` _(no auth required)_

Runs the DFS backtracking algorithm and returns up to 10 conflict-free timetable combinations for the given course codes.

> Intended to be called after `/api/chat` returns `status: "ready"`, using `parsedCourses` as the `courseCodes` input.

**Request headers**
```
Content-Type: application/json
```

**Request body**
```jsonc
{
  "courseCodes": ["20407", "20441"]   // 1–12 course codes from the Supabase catalog
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `courseCodes` | `string[]` | ✅ | 1 to 12 course codes. |

**Response `200`**
```jsonc
{
  "ok": true,
  "coursesLoaded": 2,
  "schedulesFound": 5,
  "schedules": [
    // Each inner array = one valid, conflict-free timetable
    [
      {
        "blockId": "20407-1",
        "courseCode": "20407",
        "courseName": "מבני נתונים",
        "parentGroupId": "20407-1",
        "childGroupIds": ["20407-2"],
        "lecturer": "דר׳ כהן",
        "sessions": [
          {
            "day": "ב",          // Hebrew day code: א|ב|ג|ד|ה|ו
            "startTime": "10:00",
            "endTime": "12:00",
            "room": "301"
          }
        ],
        "dayMasks": { "ב": 3072 } // internal bitmask — can be ignored by the frontend
      }
      // ... one Block per requested course
    ]
    // ... up to 10 timetable combinations
  ]
}
```

**Validation error `400`**
```json
{ "error": "courseCodes must be a non-empty array." }
```
Possible error strings:
- `"courseCodes must be a non-empty array."`
- `"All courseCodes must be strings."`
- `"Maximum 12 courses per request."`

**Server error `500`**
```json
{ "error": "..." }
```

---

## Typical Frontend Flow

```
1. User types a message in the chat UI
   │
   ├─ GET session token from Supabase client
   │
   ├─ POST /api/chat
   │    { message, conversationHistory }
   │    Authorization: Bearer <token>
   │
   ├─ Read response.status
   │    │
   │    ├─ "clarification_needed" → display botMessage, wait for next user message
   │    │
   │    └─ "ready"
   │         │
   │         ├─ Display botMessage (confirmation + any prerequisite warnings)
   │         │
   │         └─ POST /api/schedule
   │              { courseCodes: response.parsedCourses }
   │              (no auth header needed)
   │
   └─ Render the returned schedules array
```

---

## CORS

The backend allows cross-origin requests from the following origins in development:
- `http://localhost:5173` (Vite default)
- `http://localhost:4173` (Vite preview)
- `http://localhost:3001` (CRA / other bundlers)

For production, set the `ALLOWED_ORIGIN` environment variable on the backend to the deployed frontend URL.

---

## Environment Variables (backend `.env`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anonymous/public key |
| `OPENAI_API_KEY` | ✅ | OpenAI API key (used by `/api/chat`) |
| `OPENAI_MODEL` | ❌ | OpenAI model name. Defaults to `gpt-4o` |
| `ALLOWED_ORIGIN` | ❌ | Production frontend origin for CORS |
| `PORT` | ❌ | Server port. Defaults to `3000` |
