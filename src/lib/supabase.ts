import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * False when the env vars are missing, so the form can show a real message
 * instead of throwing at module load during a misconfigured deploy.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey)

/**
 * The publishable key is safe in client code. Access is controlled by row
 * level security: the waitlist table allows inserts only, so signups can be
 * written from the browser but never read back.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url as string, publishableKey as string, {
      auth: { persistSession: false },
    })
  : null

export interface WaitlistSignup {
  name: string
  email: string
  source: string
}
