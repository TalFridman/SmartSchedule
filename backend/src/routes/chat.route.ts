import { Router, Request, Response, NextFunction } from "express";
import { processChat, ConversationTurn } from "../services/chat.service";

export const chatRouter = Router();

/**
 * POST /api/chat
 * Body: { message: string, conversationHistory?: ConversationTurn[] }
 *
 * Protected by authMiddleware (applied in index.ts).
 * Returns a structured JSON response with status, parsedCourses, constraints, botMessage.
 */
chatRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { message, conversationHistory } = req.body as {
        message?: unknown;
        conversationHistory?: unknown;
      };

      // ── Validation ──────────────────────────────────────────────────────────
      if (typeof message !== "string" || message.trim().length === 0) {
        res.status(400).json({ error: "message must be a non-empty string." });
        return;
      }
      if (message.length > 1000) {
        res.status(400).json({ error: "message must be 1 000 characters or fewer." });
        return;
      }

      let history: ConversationTurn[] = [];
      if (conversationHistory !== undefined) {
        if (!Array.isArray(conversationHistory)) {
          res.status(400).json({ error: "conversationHistory must be an array." });
          return;
        }
        if (conversationHistory.length > 20) {
          res.status(400).json({ error: "conversationHistory may not exceed 20 turns." });
          return;
        }
        // Validate each turn shape
        for (const turn of conversationHistory) {
          if (
            typeof turn !== "object" ||
            turn === null ||
            !["user", "assistant"].includes((turn as ConversationTurn).role) ||
            typeof (turn as ConversationTurn).content !== "string"
          ) {
            res.status(400).json({
              error: 'Each conversationHistory entry must have role ("user"|"assistant") and content (string).',
            });
            return;
          }
        }
        history = conversationHistory as ConversationTurn[];
      }

      // ── Chat Processing ─────────────────────────────────────────────────────
      const result = await processChat(message.trim(), history);

      res.json({ ok: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);
