// ─────────────────────────────────────────────────────────────────────────────
// dataPrep.service.ts
// Queries Supabase and assembles the PreparedData structure consumed by the
// DFS backtracking scheduler.
//
// Public API:
//   prepareData(courseCodes: string[]): Promise<PreparedData>
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "../lib/supabaseClient";
import { buildDayMasks } from "../utils/bitmask";
import type {
  Session,
  Block,
  CourseBlocks,
  PreparedData,
  GroupNode,
} from "../types/schedule.types";

// ── Raw Supabase row shapes ────────────────────────────────────────────────────

interface RawGroupRow {
  group_id: string;
  course_code: string;
  type: string;
  lecturer: string | null;
  parent_group_id: string | null;
  is_scheduled: boolean;
  courses: { course_name: string }[] | { course_name: string } | null;
}

interface RawSessionRow {
  group_id: string;
  day: string;
  start_time: string;  // "HH:MM:SS" from PostgreSQL TIME
  end_time: string;
  room: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize PostgreSQL TIME string to "HH:MM". "17:00:00" → "17:00" */
function normalizeTime(t: string): string {
  return t.slice(0, 5);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Query Supabase for all groups and sessions belonging to the requested courses,
 * then assemble them into an array of CourseBlocks sorted by ascending block
 * count (MRV heuristic — most constrained courses first).
 *
 * Courses with no schedulable blocks are omitted and logged as warnings.
 */
export async function prepareData(courseCodes: string[], semester: string): Promise<PreparedData> {
  if (courseCodes.length === 0) return [];

  // ── Queries (run in parallel) ──────────────────────────────────────────────

  const [groupsResult, sessionsResult] = await Promise.all([
    // Query 1: All course_groups for the requested courses + course name, filtered by semester
    supabase
      .from("course_groups")
      .select(
        "group_id, course_code, type, lecturer, parent_group_id, is_scheduled, courses(course_name)"
      )
      .in("course_code", courseCodes)
      .eq("semester", semester),

    // Query 2: All sessions belonging to groups of the requested courses
    supabase
      .from("group_sessions")
      .select("group_id, day, start_time, end_time, room")
      .in(
        "group_id",
        // We need group_ids for the requested courses. We use a subquery-style
        // workaround: fetch group_ids via a nested join.
        // The Supabase JS client doesn't support subqueries directly, so we
        // handle this after Query 1 resolves. This placeholder is overridden below.
        ["__placeholder__"]
      ),
  ]);

  // Supabase doesn't let us do a dependent filter before Query 1 resolves,
  // so we run Query 2 properly after extracting group IDs from Query 1.
  const groupRows = (groupsResult.data ?? []) as RawGroupRow[];
  if (groupsResult.error) {
    throw new Error(`DB error fetching groups: ${groupsResult.error.message}`);
  }

  const allGroupIds = groupRows.map((r) => r.group_id);

  // Re-fetch sessions with correct group IDs
  const sessionsResult2 = await supabase
    .from("group_sessions")
    .select("group_id, day, start_time, end_time, room")
    .in("group_id", allGroupIds.length > 0 ? allGroupIds : ["__empty__"]);

  if (sessionsResult2.error) {
    throw new Error(`DB error fetching sessions: ${sessionsResult2.error.message}`);
  }

  const sessionRows = (sessionsResult2.data ?? []) as RawSessionRow[];

  // ── Pass 1: Build groupMap ────────────────────────────────────────────────

  const groupMap = new Map<string, GroupNode>();

  for (const row of groupRows) {
    groupMap.set(row.group_id, {
      groupId:       row.group_id,
      courseCode:    row.course_code,
      courseName:    (Array.isArray(row.courses) ? row.courses[0]?.course_name : row.courses?.course_name) ?? row.course_code,
      type:          row.type,
      lecturer:      row.lecturer,
      parentGroupId: row.parent_group_id,
      isScheduled:   row.is_scheduled,
      sessions:      [],
    });
  }

  // ── Pass 2: Attach sessions to their groups ───────────────────────────────

  for (const row of sessionRows) {
    const node = groupMap.get(row.group_id);
    if (!node) continue;  // defensive — should not happen

    const session: Session = {
      day:       row.day,
      startTime: normalizeTime(row.start_time),
      endTime:   normalizeTime(row.end_time),
      room:      row.room,
    };
    node.sessions.push(session);
  }

  // ── Pass 3: Build Blocks (one per schedulable parent group) ──────────────

  // Build a reverse index: parentGroupId → child GroupNodes
  const childrenByParent = new Map<string, GroupNode[]>();
  for (const node of groupMap.values()) {
    if (node.parentGroupId !== null) {
      if (!childrenByParent.has(node.parentGroupId)) {
        childrenByParent.set(node.parentGroupId, []);
      }
      childrenByParent.get(node.parentGroupId)!.push(node);
    }
  }

  const blocksByCourse = new Map<string, Block[]>();

  for (const node of groupMap.values()) {
    // Only parent (lecture/standalone) groups generate Blocks
    if (node.parentGroupId !== null) continue;
    if (!node.isScheduled) continue;

    // Gather child groups that are scheduled
    const children = (childrenByParent.get(node.groupId) ?? []).filter(
      (c) => c.isScheduled
    );

    // Merge sessions: parent's + every child's
    const allSessions: Session[] = [
      ...node.sessions,
      ...children.flatMap((c) => c.sessions),
    ];

    // Skip if there are no actual sessions (edge case)
    if (allSessions.length === 0) {
      console.warn(`[dataPrep] No sessions found for group ${node.groupId} — skipping.`);
      continue;
    }

    const block: Block = {
      blockId:       node.groupId,
      courseCode:    node.courseCode,
      courseName:    node.courseName,
      parentGroupId: node.groupId,
      childGroupIds: children.map((c) => c.groupId),
      lecturer:      node.lecturer,
      sessions:      allSessions,
      dayMasks:      buildDayMasks(allSessions),  // pre-computed here, once
    };

    if (!blocksByCourse.has(node.courseCode)) {
      blocksByCourse.set(node.courseCode, []);
    }
    blocksByCourse.get(node.courseCode)!.push(block);
  }

  // ── Pass 4: Assemble PreparedData, sorted by MRV ─────────────────────────

  const preparedData: PreparedData = [];

  for (const courseCode of courseCodes) {
    const blocks = blocksByCourse.get(courseCode) ?? [];

    if (blocks.length === 0) {
      console.warn(
        `[dataPrep] Course ${courseCode} has no schedulable blocks — omitted from results.`
      );
      continue;
    }

    preparedData.push({
      courseCode,
      courseName: blocks[0].courseName,
      blocks,
    });
  }

  // MRV: sort by ascending number of options — most constrained courses first.
  // This is the single biggest DFS pruning win and costs nothing here.
  preparedData.sort((a, b) => a.blocks.length - b.blocks.length);

  return preparedData;
}
