/**
 * Temporary end-to-end test for chat.service.ts.
 * Bypasses auth middleware — calls the service layer directly.
 *
 * Run from backend/ with:
 *   npx ts-node --transpile-only src/test-chat.ts
 *
 * Delete this file before shipping to production.
 */
import "dotenv/config";
import { processChat } from "./services/chat.service";

async function main(): Promise<void> {
  // Intentional typo: "הפלה" instead of "הפעלה"
  const message = "אני רוצה ללמוד מערכות הפלה";
  console.log("[test] Input message:", message);
  console.log("[test] Calling processChat...\n");

  const result = await processChat(message, []);

  console.log("[test] ✅ Result:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err: unknown) => {
  console.error("[test] ❌ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
