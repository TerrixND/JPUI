const nodeEnv = process.env.NODE_ENV || "development";

export const SUPABASE_PROJECT_URL =
  process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
  process.env.SUPABASE_PROJECT_URL ||
  "";

export const SUPABASE_PUB_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUB_KEY || process.env.SUPABASE_PUB_KEY || "";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  (nodeEnv === "production" ? "" : "http://localhost:3000");
