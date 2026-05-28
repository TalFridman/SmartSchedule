import { Router, Request, Response, NextFunction } from "express";
import { prepareData } from "../services/dataPrep.service";
import { findSchedules } from "../services/scheduler.service";
import { supabase } from "../lib/supabaseClient";

export const scheduleRouter = Router();

/**
 * POST /api/schedule
 * Body: { courseCodes: string[], semester: string }
 *
 * Returns up to 10 conflict-free timetable combinations as Block[][].
 */
scheduleRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { courseCodes, semester } = req.body as { courseCodes?: unknown; semester?: unknown };

      // ── Validation ──────────────────────────────────────────────────────────
      if (!Array.isArray(courseCodes) || courseCodes.length === 0) {
        res.status(400).json({ error: "courseCodes must be a non-empty array." });
        return;
      }
      if (courseCodes.some((c) => typeof c !== "string")) {
        res.status(400).json({ error: "All courseCodes must be strings." });
        return;
      }
      if (courseCodes.length > 12) {
        res.status(400).json({ error: "Maximum 12 courses per request." });
        return;
      }
      if (typeof semester !== "string" || semester.trim() === "") {
        res.status(400).json({ error: "semester must be a non-empty string (א, ב, or קיץ)." });
        return;
      }

      // ── Data Preparation ────────────────────────────────────────────────────
      const preparedData = await prepareData(courseCodes, semester.trim());

      // ── Detect courses with no groups in the requested semester ────────────
      const loadedCodes = new Set(preparedData.map((cb) => cb.courseCode));
      const missingCodes = courseCodes.filter((c) => !loadedCodes.has(c));

      let missingCourses: { code: string; name: string }[] = [];
      if (missingCodes.length > 0) {
        const { data } = await supabase
          .from("courses")
          .select("course_code, course_name")
          .in("course_code", missingCodes);
        missingCourses = (data ?? []).map((r: { course_code: string; course_name: string }) => ({
          code: r.course_code,
          name: r.course_name,
        }));
      }

      // ── Schedule Generation ─────────────────────────────────────────────────
      const schedules = findSchedules(preparedData);

      res.json({
        ok: true,
        coursesLoaded: preparedData.length,
        schedulesFound: schedules.length,
        missingCourses,
        schedules,
      });
    } catch (err) {
      next(err);
    }
  }
);
