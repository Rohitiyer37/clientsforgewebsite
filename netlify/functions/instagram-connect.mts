import type { Config } from "@netlify/functions"

import { appEnv, instagramEnv, sessionEnv } from "../../server/env"
import { handle, redirect } from "../../server/http"
import { instagramClient } from "../../server/instagram/accounts"
import {
  createOAuthState,
  parseReturnDestination,
  returnCookie,
} from "../../server/instagram/oauth"
import { getCurrentClient } from "../../server/session"

/**
 * Starts the Instagram Login flow for the signed in client. ?return=analytics
 * sends them back to Content Analytics afterwards; anything else goes to
 * Automations.
 */
export default handle("instagram-connect", async (req: Request) => {
  const client = await getCurrentClient(req)
  if (!client) return redirect("/dashboard")

  const { INSTAGRAM_APP_ID } = instagramEnv()
  const { APP_BASE_URL } = appEnv()
  const { state, cookie } = createOAuthState(client.id, sessionEnv().SESSION_SECRET)
  const dest = parseReturnDestination(new URL(req.url).searchParams.get("return"))

  const url = instagramClient().authorizeUrl({
    appId: INSTAGRAM_APP_ID,
    redirectUri: `${APP_BASE_URL}/api/instagram/callback`,
    state,
  })
  return redirect(url, [cookie, returnCookie(dest)])
})

export const config: Config = {
  path: "/api/instagram/connect",
  method: "GET",
}
