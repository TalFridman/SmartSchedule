// ─────────────────────────────────────────────────────────────────────────────
// auth.middleware.ts
// Verifies the caller's Supabase JWT before allowing access to protected routes.
//
// Usage:
//   app.use("/api/chat", authMiddleware, chatRouter);
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from "express";
import { supabase } from "../lib/supabaseClient";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header." });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  const { error } = await supabase.auth.getUser(token);

  if (error) {
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }

  next();
}
