import "dotenv/config";
import express from "express";
import cors from "cors";
import { scheduleRouter } from "./routes/schedule.route";
import { chatRouter } from "./routes/chat.route";
import { authMiddleware } from "./middleware/auth.middleware";

const app  = express();
const PORT = process.env.PORT ?? 3000;

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow local frontend dev servers. In production, replace with the deployed
// frontend origin via the ALLOWED_ORIGIN env var.
const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN,          // production / staging override
  "http://localhost:5173",             // Vite default
  "http://localhost:4173",             // Vite preview
  "http://localhost:3001",             // CRA / other bundlers
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, same-origin)
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' is not allowed.`));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/schedule", scheduleRouter);
app.use("/api/chat", authMiddleware, chatRouter);

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err);
  const message = err instanceof Error ? err.message : "Internal server error";
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
