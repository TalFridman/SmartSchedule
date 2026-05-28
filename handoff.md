# Handoff — Afeka Schedule Generator

---

## Goal
Build a full-stack **course schedule generator** for Afeka College students.
The student picks a list of courses (chat with llm); the system finds all valid, conflict-free timetable combinations using a **backtracking (DFS) algorithm** on the backend and presents the results on the frontend.

Stack: Node.js + TypeScript backend · Supabase (PostgreSQL) · React frontend (not started).

---

## Current State
| Layer | Status |
|---|---|
| Database | ✅ Fully seeded — 451 courses, 2 241 groups, 2 597 sessions, 855 prerequisites |
| Import pipeline | ✅ `import_to_supabase.py` — idempotent, handles orphaned groups |
| Backend scaffolding | ✅ Express + TypeScript project bootstrapped (`backend/`) |
| Data types | ✅ `Session`, `Block`, `CourseBlocks`, `PreparedData`, `DayMasks` defined |
| Bitmask engine | ✅ `sessionToBitmask`, `buildDayMasks`, `blocksConflict` — tested & verified |
| Data Preparation | ✅ `prepareData(courseCodes[])` — 2 parallel DB queries → 4-pass assembly → MRV sort |
| HTTP endpoint | ✅ `POST /api/schedule { courseCodes[] }` — returns `PreparedData` JSON |
| **DFS Scheduler** | ❌ **Not written yet** — this is the next step |
| Frontend | ❌ Not started |

The server runs on `http://localhost:3000`.
`GET /health` → `{ ok: true }`
`POST /api/schedule` → returns fully assembled `PreparedData` (Block objects with pre-computed `dayMasks`).

---

## Files in Flight
These files will be touched in the next session:

| File | Why |
|---|---|
| `backend/src/services/scheduler.service.ts` | **Create** — the DFS backtracking engine (does not exist yet) |
| `backend/src/routes/schedule.route.ts` | **Edit** — wire the scheduler call after `prepareData()` and return the final timetable instead of raw `PreparedData` |

---

## Changed This Session

### Database / Python
| File | What happened |
|---|---|
| `import_to_supabase.py` | Created from scratch; imports all 4 tables in FK-safe order; idempotent (upsert + delete-then-insert); orphan-guard added |
| `afeka_courses_all.json` | New full dataset (all semesters, 2 645 records) replacing the summer-only file |
| `.gitignore` | Created at repo root — covers Node, Python, `.env`, OS/editor files |

### Backend (all created from scratch)
```
backend/
├── .env                              Supabase URL + anon key + PORT
├── package.json                      express, @supabase/supabase-js, dotenv, ts-node-dev
├── tsconfig.json
└── src/
    ├── index.ts                      Express entry point, /health route, error handler
    ├── lib/supabaseClient.ts         Singleton Supabase client
    ├── types/schedule.types.ts       Session, Block, CourseBlocks, PreparedData, GroupNode
    ├── utils/bitmask.ts              sessionToBitmask, buildDayMasks, blocksConflict
    ├── services/dataPrep.service.ts  prepareData() — DB queries + 4-pass assembly
    └── routes/schedule.route.ts      POST /api/schedule with input validation
```

---

## Failed Attempts

| What | Why it failed | Fix applied |
|---|---|---|
| `import_to_supabase.py` — first run on full dataset | FK violation on `course_groups`: 2 child groups (`269090524/1`, `269092610/1`) referenced parent IDs that don't exist in the JSON (scraper missed those parent rows) | Added orphan-guard: filter children whose `parent_group_id` isn't in the inserted parents set; log skipped groups |
| Same script — second run | FK violation on `group_sessions`: sessions were still being built for the 2 orphaned group IDs even though the groups themselves were skipped | Added `inserted_group_ids` set; session-building loop skips any `row["group"]` not in that set |
| First run of `import_to_supabase.py` on Windows | `UnicodeEncodeError` — emoji characters (📂 ✅ ──) in `print()` calls couldn't be encoded by the Windows cp1255 terminal code page | Replaced all emoji and Unicode box-drawing chars with plain ASCII (`[*]`, `[ok]`, `[!]`, `---`) |
| Supabase JS join type mismatch | `courses(course_name)` in a Supabase `.select()` returns an **array** `{ course_name }[]`, not a single object — caused a TypeScript compile error in `dataPrep.service.ts` | Changed `RawGroupRow.courses` type to accept both array and object; access via `Array.isArray` guard |

---

## Next Step
**Write the DFS backtracking scheduler** in `backend/src/services/scheduler.service.ts`.

```ts
// Signature to implement:
export function findSchedules(
  data: PreparedData,
  maxResults?: number          // e.g. stop after 10 valid schedules
): Block[][]                   // each inner array = one valid full timetable
```

Algorithm sketch:
1. Iterate `PreparedData` (already MRV-sorted — most constrained course first).
2. For each course, try each `Block` in order.
3. Before placing a block, call `blocksConflict(candidate, alreadyPlaced[i])` for every placed block — O(N·D) total, where D ≤ 6.
4. If no conflict → recurse to the next course.
5. If all courses are placed → push the current assignment to results.
6. Backtrack if conflict or no blocks remain.

Once written, update `schedule.route.ts` to call `findSchedules(preparedData)` and return the timetable array to the frontend.
