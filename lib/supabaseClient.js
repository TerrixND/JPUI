import { createBrowserClient } from "@supabase/ssr";
import {
    SUPABASE_PROJECT_URL,
    SUPABASE_PUB_KEY
} from "../config/env";

export const supabaseBrowserClient = createBrowserClient(
    SUPABASE_PROJECT_URL,
    SUPABASE_PUB_KEY
);