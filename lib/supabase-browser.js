import { createClient } from "@supabase/supabase-js";

const browserSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const browserSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const browserSupabase =
  browserSupabaseUrl && browserSupabaseAnonKey
    ? createClient(browserSupabaseUrl, browserSupabaseAnonKey)
    : null;
