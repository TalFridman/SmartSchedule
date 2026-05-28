// ─────────────────────────────────────────────────────────────────────────────
// chatService.ts
// Client-side wrapper for the POST /api/chat endpoint.
//
// Usage:
//   const result = await sendMessage("I want Data Structures and no Sundays", history);
//   if (result.status === "ready") {
//     // pass result.parsedCourses to the schedule generator
//   }
// ─────────────────────────────────────────────────────────────────────────────

// ── Types (mirrored from backend/src/services/chat.service.ts) ───────────────

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatConstraints {
  blockedDays?: string[];
  preferredTimeRange?: { start: string; end: string };
  maxDaysPerWeek?: number;
}

export interface ChatResponse {
  ok: boolean;
  status: "ready" | "clarification_needed";
  parsedCourses: string[];
  constraints: ChatConstraints;
  botMessage: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// ── Token helper ──────────────────────────────────────────────────────────────
// Replace this stub with your actual Supabase client call once the frontend
// Supabase client is initialised (e.g. supabase.auth.getSession()).

async function getAccessToken(): Promise<string> {
  // TODO: import { supabase } from "../lib/supabaseClient";
  // const { data } = await supabase.auth.getSession();
  // return data.session?.access_token ?? "";
  throw new Error("getAccessToken() not yet wired to Supabase client.");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function sendMessage(
  message: string,
  conversationHistory: ConversationTurn[] = []
): Promise<ChatResponse> {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, conversationHistory }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error((err as { error?: string }).error ?? "Chat request failed.");
  }

  return response.json() as Promise<ChatResponse>;
}
