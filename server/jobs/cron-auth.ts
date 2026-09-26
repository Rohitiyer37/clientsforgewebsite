import { safeEqual } from "../crypto"
import { cronEnv } from "../env"

/** Accepts "Authorization: Bearer <CRON_SECRET>" only, compared in constant time. */
export function isAuthorizedCron(req: Request): boolean {
  const header = req.headers.get("authorization") ?? ""
  const match = /^Bearer (.+)$/.exec(header)
  if (!match?.[1]) return false
  return safeEqual(match[1], cronEnv().CRON_SECRET)
}
