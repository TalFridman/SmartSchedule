// ─────────────────────────────────────────────────────────────────────────────
// bitmask.ts
// Pure, dependency-free utilities for fast time-slot conflict detection.
//
// Slot model
//   Base   : 08:00 = slot 0
//   Width  : 30 minutes per slot
//   Range  : slots 0–27  →  08:00–22:00  (28 slots, fits in a 32-bit int)
//
// A slot N is "occupied" by a session if the session overlaps the interval
//   [08:00 + N×30 min,  08:00 + (N+1)×30 min)
// ─────────────────────────────────────────────────────────────────────────────

import type { Session, DayMasks, Block } from "../types/schedule.types";

const BASE_MINUTES = 8 * 60; // 480 — minutes from midnight to 08:00
const SLOT_WIDTH   = 30;     // minutes per slot

/**
 * Convert a "HH:MM" time string to total minutes from midnight.
 * "17:00" → 1020
 */
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Compute a bitmask for a single session [startTime, endTime).
 *
 * Example — 17:00–18:50:
 *   startSlot = floor((1020 - 480) / 30) = 18
 *   endSlot   = ceil ((1130 - 480) / 30) = ceil(21.67) = 22
 *   Bits set: 18, 19, 20, 21
 *   → mask = 0b0000_0000_0011_1100_0000_0000_0000_0000
 */
export function sessionToBitmask(startTime: string, endTime: string): number {
  const startMin  = timeToMinutes(startTime);
  const endMin    = timeToMinutes(endTime);
  const startSlot = Math.floor((startMin - BASE_MINUTES) / SLOT_WIDTH);
  const endSlot   = Math.ceil ((endMin   - BASE_MINUTES) / SLOT_WIDTH);

  let mask = 0;
  for (let s = startSlot; s < endSlot; s++) {
    mask |= (1 << s);
  }
  return mask;
}

/**
 * Build a DayMasks object from an array of sessions.
 * Sessions on the same day are OR-combined into a single bitmask.
 *
 * Called once per Block during data preparation — never during DFS.
 */
export function buildDayMasks(sessions: Session[]): DayMasks {
  const masks: DayMasks = {};
  for (const s of sessions) {
    const contribution = sessionToBitmask(s.startTime, s.endTime);
    masks[s.day] = (masks[s.day] ?? 0) | contribution;
  }
  return masks;
}

/**
 * Check whether two Blocks have any overlapping session time.
 *
 * HOT PATH — called in the DFS inner loop.
 * Complexity: O(D) where D = distinct days in Block a (max 6).
 * No heap allocation; single bitwise AND per day.
 *
 * Returns true if there is a time conflict, false otherwise.
 */
export function blocksConflict(a: Block, b: Block): boolean {
  for (const day in a.dayMasks) {
    if (b.dayMasks[day] !== undefined) {
      if ((a.dayMasks[day] & b.dayMasks[day]) !== 0) {
        return true;
      }
    }
  }
  return false;
}
