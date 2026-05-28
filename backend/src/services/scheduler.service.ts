import { blocksConflict } from "../utils/bitmask";
import type { Block, PreparedData } from "../types/schedule.types";

const DEFAULT_MAX_RESULTS = 10;

export function findSchedules(
  data: PreparedData,
  maxResults: number = DEFAULT_MAX_RESULTS
): Block[][] {
  const results: Block[][] = [];
  const placed: Block[] = [];

  function dfs(courseIndex: number): void {
    if (results.length >= maxResults) return;

    if (courseIndex === data.length) {
      results.push([...placed]);
      return;
    }

    for (const candidate of data[courseIndex].blocks) {
      if (results.length >= maxResults) return;

      let conflict = false;
      for (const placedBlock of placed) {
        if (blocksConflict(candidate, placedBlock)) {
          conflict = true;
          break;
        }
      }

      if (conflict) continue;

      placed.push(candidate);
      dfs(courseIndex + 1);
      placed.pop();
    }
  }

  dfs(0);
  return results;
}
