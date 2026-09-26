import { z } from "zod"

export const LoginSchema = z.object({
  pin: z.string().min(1, "Enter your PIN").max(128),
})

export type LoginInput = z.infer<typeof LoginSchema>

/** Shown for every wrong PIN. Never reveals whether a PIN exists. */
export const PIN_FAILED_MESSAGE = "That PIN didn't work."
export const RATE_LIMITED_MESSAGE = "Too many attempts, try again later."
