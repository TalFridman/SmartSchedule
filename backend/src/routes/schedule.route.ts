import { Router, Request, Response, NextFunction } from "express";
import { prepareData } from "../services/dataPrep.service";

export const scheduleRouter = Router();

/**
 * POST /api/schedule
 * Body: { courseCodes: string[] }
 *
 * Returns the PreparedData structure ready for the DFS backtracker.
 * (In the next phase this will also run the scheduler and return the final timetable.)
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

      // TODO (next phase): pass preparedData to the DFS scheduler here.
      // For now, return the prepared data so it can be verified.
      res.json({
        ok: true,
        coursesLoaded: preparedData.length,
        data: preparedData,
      });
    } catch (err) {
      next(err);
    }
  }
);
