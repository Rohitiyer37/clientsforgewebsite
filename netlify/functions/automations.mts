import type { Config } from "@netlify/functions"

import { AutomationInputSchema } from "../../shared/automation"
import { listAutomations, saveAutomation } from "../../server/automations/service"
import { db } from "../../server/db"
import { assertSameOrigin, handle, json, readJson } from "../../server/http"
import { log } from "../../server/log"
import { requireClient } from "../../server/session"

export default handle("automations", async (req: Request) => {
  const client = await requireClient(req)
  const database = db()

  if (req.method === "GET") {
    return json({ automations: await listAutomations(database, client.id) })
  }

  assertSameOrigin(req)
  const input = await readJson(req, AutomationInputSchema)
  const automation = await saveAutomation(database, client.id, null, input)
  log.info("automation_created", { clientId: client.id, automationId: automation.id })
  return json({ automation }, 201)
})

export const config: Config = {
  path: "/api/automations",
  method: ["GET", "POST"],
}
