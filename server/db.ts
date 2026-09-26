import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "./database.types"
import { supabaseEnv } from "./env"

export type Db = SupabaseClient<Database>

let cached: Db | null = null

/**
 * Service role client. Bypasses row level security, so it must only ever run
 * server side and every query must scope by client_id itself.
 */
export function db(): Db {
  if (cached) return cached
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = supabaseEnv()
  cached = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}
