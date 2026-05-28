# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Afeka College course schedule generator. Students select courses; the system finds all conflict-free timetable combinations via a DFS backtracking algorithm.

**Stack:** Node.js + TypeScript (Express) backend · Supabase (PostgreSQL) · React frontend (not yet started).

## Backend Commands

Run from `backend/`:

```bash
npm run dev      # ts-node-dev with hot reload (development)
npm run build    # tsc → dist/
npm start        # run compiled dist/index.js
```

**Environment:** Requires `backend/.env` with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and optionally `PORT` (default 3000).

## Database Import

From repo root:

```bash
python import_to_supabase.py
```

Idempotent — safe to re-run. Imports 4 tables in FK-safe order from `afeka_courses_all.json`. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in environment or `.env`.

## Architecture

### Data Flow

```
POST /api/schedule { courseCodes[] }
  → prepareData()          — 2 parallel Supabase queries → 4-pass in-memory assembly
  → findSchedules()        — DFS backtracker (not yet written)
  → response: Block[][]    — each inner array = one valid timetable
```

### Key Types (`backend/src/types/schedule.types.ts`)

- **`Session`** — one meeting time (day, startTime, endTime, room)
- **`Block`** — one atomic scheduling choice: a parent (lecture) group + all its linked child groups (practice/lab), with all sessions merged. The DFS picks exactly one `Block` per course.
- **`DayMasks`** — `Record<day, bitmask>` — 30-min slots from 08:00, pre-computed once per Block, never recomputed during DFS.
- **`CourseBlocks`** — all `Block` options for one course.
- **`PreparedData`** — `CourseBlocks[]` sorted ascending by `blocks.length` (MRV heuristic).

### Conflict Detection (`backend/src/utils/bitmask.ts`)

Hot path — called in the DFS inner loop. `blocksConflict(a, b)` iterates days in `a.dayMasks` and does a bitwise AND against `b.dayMasks[day]`. O(D) where D ≤ 6. No allocation.

### Data Preparation (`backend/src/services/dataPrep.service.ts`)

`prepareData(courseCodes[])` runs 2 Supabase queries (groups + sessions), then 4 in-memory passes:
1. Build `groupMap` (group_id → GroupNode)
2. Attach sessions to groups
3. Build `Block` objects (one per schedulable parent group); `buildDayMasks()` called here, once
4. Assemble `PreparedData` and apply MRV sort

Supabase JS returns `courses(course_name)` as an array — handled with `Array.isArray` guard.

### What's Next

`backend/src/services/scheduler.service.ts` — **does not exist yet**. Signature:

```ts
export function findSchedules(data: PreparedData, maxResults?: number): Block[][]
```

After writing it, wire it into `backend/src/routes/schedule.route.ts` after the `prepareData()` call.

### Singleton Pattern

`backend/src/lib/supabaseClient.ts` exports a single `SupabaseClient`. Import `supabase` from there everywhere — never call `createClient()` again.
