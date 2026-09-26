import type { Config, Context } from "@netlify/functions"
import { z } from "zod"

import { AutomationInputSchema, ToggleSchema } from "../../shared/automation"
import {
  deleteAutomation,
  getAutomation,
  listEvents,
  saveAutomation,
  setAutomationActive,
} from "../../server/automations/service"
import { db } from "../../server/db"
import { HttpError, assertSameOrigin, handle, json, readJson } from "../../server/http"
import { log } from "../../server/log"
import { requireClient } from "../../server/session"

const IdSchema = z.uuid()

export default handle("automation-item", async (req: Request, context: Context) => {
  const client = await requireClient(req)
  const parsedId = IdSchema.safeParse(context.params.id)
  if (!parsedId.success) throw new HttpError(404, "Automation not found")
  const id = parsedId.data
  const database = db()
  const isEvents = new URL(req.url).pathname.endsWith("/events")

  if (isEvents) {
    if (req.method !== "GET") throw new HttpError(405, "Method not allowed")
    return json({ events: await listEvents(database, client.id, id) })
  }

  switch (req.method) {
    case "GET":
      return json({ automation: await getAutomation(database, client.id, id) })

    case "PUT": {
      assertSameOrigin(req)
      const input = await readJson(req, AutomationInputSchema)
      const automation = await saveAutomation(database, client.id, id, input)
      log.info("automation_updated", { clientId: client.id, automationId: id })
      return json({ automation })
    }

    case "PATCH": {
      assertSameOrigin(req)
      const { isActive } = await readJson(req, ToggleSchema)
      const automation = await setAutomationActive(database, client.id, id, isActive)
      log.info("automation_toggled", { clientId: client.id, automationId: id, isActive })
      return json({ automation })
    }

    case "DELETE":
      assertSameOrigin(req)
      await deleteAutomation(database, client.id, id)
      log.info("automation_deleted", { clientId: client.id, automationId: id })
      return json({ ok: true })

    default:
      throw new HttpError(405, "Method not allowed")
  }
})

export const config: Config = {
  path: ["/api/automations/:id", "/api/automations/:id/events"],
  method: ["GET", "PUT", "PATCH", "DELETE"],
}
