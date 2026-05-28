import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

const url  = process.env.SUPABASE_URL;
const key  = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables."
  );
}

/**
 * Singleton Supabase client.
 * Import this wherever you need to query the DB — never call createClient() again.
 */
export const supabase: SupabaseClient = createClient(url, key);
