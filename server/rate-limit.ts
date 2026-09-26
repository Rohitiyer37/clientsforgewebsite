import type { Db } from "./db"

export const LOGIN_WINDOW_MS = 15 * 60 * 1000
export const LOGIN_MAX_FAILURES = 5

/** Storage behind the limiter. Abstracted so the logic is testable. */
export interface AttemptStore {
  countFailuresSince(ip: string, since: Date): Promise<number>
  record(ip: string, success: boolean): Promise<void>
}

/**
 * True when this IP may attempt a login: fewer than 5 failed attempts in the
 * last 15 minutes. The window slides, so the oldest failure expiring frees
 * one more attempt.
 */
export async function isLoginAllowed(
  store: AttemptStore,
  ip: string,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - LOGIN_WINDOW_MS)
  const failures = await store.countFailuresSince(ip, since)
  return failures < LOGIN_MAX_FAILURES
}

export function supabaseAttemptStore(database: Db): AttemptStore {
  return {
    async countFailuresSince(ip, since) {
      const { count, error } = await database
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip", ip)
        .eq("success", false)
        .gte("attempted_at", since.toISOString())
      if (error) throw new Error(`Rate limit lookup failed: ${error.message}`)
      return count ?? 0
    },
    async record(ip, success) {
      const { error } = await database
        .from("login_attempts")
        .insert({ ip, success })
      if (error) throw new Error(`Failed to record login attempt: ${error.message}`)
    },
  }
}
