import type { Config } from "@netlify/functions"
import { z } from "zod"

import { isReel } from "../../shared/instagram"
import { db } from "../../server/db"
import { HttpError, handle, json } from "../../server/http"
import {
  handleGraphError,
  instagramClient,
  requireActiveAccount,
} from "../../server/instagram/accounts"
import { requireClient } from "../../server/session"

const QuerySchema = z.object({
  after: z
    .string()
    .max(512)
    .regex(/^[A-Za-z0-9_=-]+$/)
    .optional(),
})

/** Recent posts for the reel picker, reels first within each page. */
export default handle("instagram-media", async (req: Request) => {
  const client = await requireClient(req)
  const parsed = QuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  )
  if (!parsed.success) throw new HttpError(400, "Invalid pagination cursor")

  const database = db()
  const { account, token } = await requireActiveAccount(database, client.id)

  try {
    const page = await instagramClient().listMedia(token, parsed.data.after)
    const items = [...page.items].sort((a, b) => Number(isReel(b)) - Number(isReel(a)))
    return json({ items, nextCursor: page.nextCursor })
  } catch (err) {
    return handleGraphError(database, account, err)
  }
})

export const config: Config = {
  path: "/api/instagram/media",
  method: "GET",
}
