import { createClient } from "@supabase/supabase-js";

import { SUPABASE_PUB_KEY, SUPABASE_PROJECT_URL } from "../config/env";

export const isSupabaseConfigured = Boolean(
  SUPABASE_PROJECT_URL && SUPABASE_PUB_KEY,
);

const supabase = createClient(
  SUPABASE_PROJECT_URL || "https://placeholder.supabase.co",
  SUPABASE_PUB_KEY || "placeholder-pub-key",
);

export default supabase;
