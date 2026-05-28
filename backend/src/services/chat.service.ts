// ─────────────────────────────────────────────────────────────────────────────
// chat.service.ts
// Natural Language Scheduling Assistant — core intelligence pipeline.
//
// Public API:
//   processChat(message, conversationHistory): Promise<ChatResponse>
//
// Pipeline:
//   Phase A — Fetch compact course catalog from Supabase
//   Phase B — Build system prompt (with catalog + no-guessing rules)
//   Phase C — Call OpenAI with Structured Outputs (guaranteed JSON contract)
//   Phase D — Enrich botMessage with prerequisite warnings
// ─────────────────────────────────────────────────────────────────────────────

import OpenAI from "openai";
import { supabase } from "../lib/supabaseClient";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  status: "ready" | "clarification_needed";
  semester: string;
  parsedCourses: string[];
  constraints: ChatConstraints;
  botMessage: string;
}

// ── OpenAI client (singleton) ─────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL  = process.env.OPENAI_MODEL ?? "gpt-4o";

// ── JSON Schema for Structured Outputs ────────────────────────────────────────

const RESPONSE_SCHEMA = {
  name: "scheduling_response",
  strict: true,
  schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["ready", "clarification_needed"],
        description:
          "'ready' only when ALL requested courses are confidently matched to the catalog. " +
          "'clarification_needed' if ANY course is ambiguous, misspelled, or not found.",
      },
      semester: {
        type: "string",
        enum: ["א", "ב", "קיץ", ""],
        description:
          "The semester extracted from the student's message: 'א', 'ב', or 'קיץ'. " +
          "Empty string if the student has not specified a semester yet.",
      },
      parsedCourses: {
        type: "array",
        items: { type: "string" },
        description:
          "Array of course codes from the catalog. ONLY include courses with a confident, " +
          "unambiguous match. Never guess or invent codes.",
      },
      constraints: {
        type: "object",
        properties: {
          blockedDays: {
            type: "array",
            items: { type: "string" },
            description: "Days the student wants no classes, e.g. ['Sunday', 'Saturday'].",
          },
          preferredTimeRange: {
            type: "object",
            properties: {
              start: { type: "string", description: "HH:MM, e.g. '09:00'" },
              end:   { type: "string", description: "HH:MM, e.g. '18:00'" },
            },
            required: ["start", "end"],
            additionalProperties: false,
          },
          maxDaysPerWeek: {
            type: "integer",
            description: "Maximum number of distinct days the student wants classes.",
          },
        },
        required: ["blockedDays", "preferredTimeRange", "maxDaysPerWeek"],
        additionalProperties: false,
      },
      botMessage: {
        type: "string",
        description:
          "Conversational reply to the user. When status is 'clarification_needed', " +
          "explicitly name which course(s) were unclear and ask the user to clarify. " +
          "When prerequisites are missing, warn the user here.",
      },
    },
    required: ["status", "semester", "parsedCourses", "constraints", "botMessage"],
    additionalProperties: false,
  },
} as const;

// ── Phase A: Course Catalog ───────────────────────────────────────────────────

interface CourseRow {
  course_code: string;
  course_name: string;
}

async function fetchCourseCatalog(): Promise<CourseRow[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("course_code, course_name")
    .order("course_name");

  if (error) throw new Error(`DB error fetching course catalog: ${error.message}`);
  return (data ?? []) as CourseRow[];
}

// ── Phase B: System Prompt ────────────────────────────────────────────────────

function buildSystemPrompt(catalog: CourseRow[]): string {
  const catalogLines = catalog
    .map((c) => `  ${c.course_code} — ${c.course_name}`)
    .join("\n");

  return `You are a scheduling assistant for Afeka College of Engineering.
Your job is to interpret a student's natural language request and extract:
  1. Which courses they want to take (mapped to exact course codes from the catalog below).
  2. Any scheduling constraints they mention (blocked days, preferred time windows, etc.).

LANGUAGE RULE — ABSOLUTE:
- You MUST always write botMessage in Hebrew only, no matter what language the student uses.
- Never write even a single word in English or any other language in botMessage.

SEMESTER RULE:
- Extract the semester from the student's message and place it in the "semester" field:
    "א" for semester A, "ב" for semester B, "קיץ" for summer. Empty string if not mentioned.
- If the semester is not mentioned, set status to "clarification_needed", set semester to "",
  and ask the student to specify it (א / ב / קיץ) in botMessage before doing anything else.
- Only attempt to match course names once the semester field is non-empty.

EXACT-MATCH RULES — THESE ARE ABSOLUTE AND MUST NEVER BE BROKEN:
- The catalog contains courses in both Hebrew and English.
- NO translation is allowed. Do not translate a Hebrew name to English or vice versa.
- NO fuzzy matching, NO typo correction, NO partial matching, NO abbreviation expansion.
- A course may be added to parsedCourses ONLY when the student's input matches a catalog
  entry CHARACTER-FOR-CHARACTER (100% exact, including spacing and punctuation).
- If the input does not match any catalog entry exactly:
    → Do NOT add it to parsedCourses.
    → Set status to "clarification_needed".
    → In botMessage, tell the student explicitly that the course name was not found or
      appears to contain a typo, and instruct them to write the name exactly as it appears
      on the college website / course catalog.
- Set status to "ready" ONLY when every course the student mentioned has a 100% exact
  catalog match. Even one unmatched course forces status to "clarification_needed".
- Never invent, guess, or infer course codes.

AVAILABLE COURSES (course_code — course_name):
${catalogLines}

OUTPUT FORMAT: Respond with valid JSON matching the provided schema exactly.
Days of the week should be in English (Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday).
Time values in HH:MM 24-hour format.`;
}

// ── Phase D: Prerequisite Enrichment ─────────────────────────────────────────

interface PrerequisiteRow {
  course_code: string;
  req_course_name: string;
  condition_group: number;
}

async function fetchPrerequisites(courseCodes: string[]): Promise<PrerequisiteRow[]> {
  if (courseCodes.length === 0) return [];

  const { data, error } = await supabase
    .from("prerequisites")
    .select("course_code, req_course_name, condition_group")
    .in("course_code", courseCodes);

  if (error) throw new Error(`DB error fetching prerequisites: ${error.message}`);
  return (data ?? []) as PrerequisiteRow[];
}

function buildPrerequisiteWarning(prerequisites: PrerequisiteRow[], catalog: CourseRow[]): string | null {
  if (prerequisites.length === 0) return null;

  const courseNameById = new Map(catalog.map((c) => [c.course_code, c.course_name]));

  // Group: course_code → condition_group → req_course_names[]
  const byCourse = new Map<string, Map<number, string[]>>();
  for (const row of prerequisites) {
    if (!byCourse.has(row.course_code)) byCourse.set(row.course_code, new Map());
    const byGroup = byCourse.get(row.course_code)!;
    if (!byGroup.has(row.condition_group)) byGroup.set(row.condition_group, []);
    byGroup.get(row.condition_group)!.push(row.req_course_name);
  }

  const lines: string[] = ["⚠️ שים לב לדרישות קדם:"];

  for (const [courseCode, byGroup] of byCourse) {
    const courseName = courseNameById.get(courseCode) ?? courseCode;
    lines.push(`עבור ${courseName} (${courseCode}):`);
    for (const names of byGroup.values()) {
      lines.push(`• ${names.join(" או ")}`);
    }
  }

  return lines.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function processChat(
  message: string,
  conversationHistory: ConversationTurn[]
): Promise<ChatResponse> {
  // Phase A — Course catalog
  const catalog = await fetchCourseCatalog();

  // Phase B — System prompt
  const systemPrompt = buildSystemPrompt(catalog);

  // Phase C — OpenAI Structured Outputs
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user", content: message },
  ];

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages,
    response_format: {
      type: "json_schema",
      json_schema: RESPONSE_SCHEMA,
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned an empty response.");

  const parsed = JSON.parse(raw) as ChatResponse;

  // Phase D — Prerequisite enrichment (only if courses were matched)
  if (parsed.parsedCourses.length > 0) {
    const prerequisites = await fetchPrerequisites(parsed.parsedCourses);
    const warning = buildPrerequisiteWarning(prerequisites, catalog);

    if (warning) {
      parsed.botMessage = `${parsed.botMessage}\n\n${warning}`;
    }
  }

  return parsed;
}
