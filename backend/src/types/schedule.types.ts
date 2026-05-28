// ─────────────────────────────────────────────────────────────────────────────
// schedule.types.ts
// Core domain types for the schedule generator.
// Used by dataPrep.service, bitmask.ts, and (future) scheduler.service.
// ─────────────────────────────────────────────────────────────────────────────

/** One physical meeting time for a group. */
export interface Session {
  day: string;        // Hebrew day code: "א"|"ב"|"ג"|"ד"|"ה"|"ו"
  startTime: string;  // "HH:MM"  e.g. "17:00"
  endTime: string;    // "HH:MM"  e.g. "18:50"
  room: string | null;
}

/**
 * Pre-computed 30-min-slot bitmask per day.
 * Bit N is set when slot N (N×30 min after 08:00) is occupied.
 * 28 slots cover 08:00–22:00, fitting safely in a 32-bit integer.
 */
export type DayMasks = Record<string, number>;

/**
 * A Block = one unbreakable scheduling choice for a course.
 * It combines one parent (lecture) group + all its linked child groups
 * (practice / lab), with ALL their sessions collapsed into a single object.
 *
 * The backtracker picks exactly one Block per course and never splits it.
 */
export interface Block {
  /** Stable unique key for DFS state tracking (= parentGroupId). */
  blockId: string;
  courseCode: string;
  courseName: string;
  parentGroupId: string;
  /** Empty array when the course has no practice/lab groups. */
  childGroupIds: string[];
  lecturer: string | null;
  /** All sessions: parent + every child. Used for display/export only. */
  sessions: Session[];
  /**
   * HOT PATH — the only field the conflict checker reads.
   * Pre-computed once in dataPrep; never recomputed during backtracking.
   */
  dayMasks: DayMasks;
}

/** All schedulable Block options for one requested course. */
export interface CourseBlocks {
  courseCode: string;
  courseName: string;
  /** One entry per schedulable parent group. The backtracker picks one. */
  blocks: Block[];
}

/** Final output of prepareData(). Sorted by ascending blocks.length (MRV). */
export type PreparedData = CourseBlocks[];

// ─── Internal assembly type (not exposed to callers) ─────────────────────────

/** Intermediate node used only during in-memory assembly. */
export interface GroupNode {
  groupId: string;
  courseCode: string;
  courseName: string;
  type: string;
  lecturer: string | null;
  parentGroupId: string | null;
  isScheduled: boolean;
  sessions: Session[];  // populated in Pass 2
}
