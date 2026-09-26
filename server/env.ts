import { z } from "zod"

/**
 * Environment access, validated per feature. Each getter only demands the
 * variables that feature needs, so PIN login works before the Instagram app
 * credentials exist, and a missing value fails loudly with its name instead
 * of surfacing later as a confusing runtime error.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ConfigError"
  }
}

function read<T extends z.ZodRawShape>(shape: T): z.infer<z.ZodObject<T>> {
  const source: Record<string, string | undefined> = {}
  for (const key of Object.keys(shape)) source[key] = process.env[key]
  const parsed = z.object(shape).safeParse(source)
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ")
    throw new ConfigError(`Missing or invalid environment variables: ${names}`)
  }
  return parsed.data
}

export function supabaseEnv() {
  return read({
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  })
}

export function sessionEnv() {
  return read({
    SESSION_SECRET: z.string().min(32),
  })
}

export function cryptoEnv() {
  return read({
    // 32 random bytes, base64 encoded (44 characters).
    TOKEN_ENCRYPTION_KEY: z.string().min(40),
  })
}

export function appEnv() {
  return read({
    APP_BASE_URL: z
      .string()
      .url()
      .transform((v) => v.replace(/\/+$/, "")),
  })
}

export function instagramEnv() {
  return read({
    INSTAGRAM_APP_ID: z.string().min(1),
    INSTAGRAM_APP_SECRET: z.string().min(1),
    META_GRAPH_API_VERSION: z
      .string()
      .regex(/^v\d+\.\d+$/)
      .default("v25.0"),
  })
}

/** Only the app secret, for verifying Meta's signed callbacks. */
export function appSecretEnv() {
  return read({
    INSTAGRAM_APP_SECRET: z.string().min(1),
  })
}

export function webhookEnv() {
  return read({
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
    INSTAGRAM_APP_SECRET: z.string().min(1),
  })
}

export function cronEnv() {
  return read({
    CRON_SECRET: z.string().min(32),
  })
}
