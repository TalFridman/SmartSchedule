import { Router, Request, Response, NextFunction } from "express";
import { prepareData } from "../services/dataPrep.service";
import { findSchedules } from "../services/scheduler.service";

export const scheduleRouter = Router();

/**
 * POST /api/schedule
 * Body: { courseCodes: string[] }
 *
 * Returns up to 10 conflict-free timetable combinations as Block[][].
 */
scheduleRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { courseCodes } = req.body as { courseCodes?: unknown };

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

      // ── Data Preparation ────────────────────────────────────────────────────
      const preparedData = await prepareData(courseCodes);

      // ── Schedule Generation ─────────────────────────────────────────────────
      const schedules = findSchedules(preparedData);

      res.json({
        ok: true,
        coursesLoaded: preparedData.length,
        schedulesFound: schedules.length,
        schedules,
      });
    } catch (err) {
      next(err);
    }
  }
);
