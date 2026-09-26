/**
 * Structured JSON logging. Any field whose key looks sensitive is redacted
 * before it is written, as a backstop in case a caller passes one by mistake.
 * Never log tokens, PINs, cookies, or raw webhook bodies.
 */

type Level = "info" | "warn" | "error"
export type LogFields = Record<string, unknown>

const SENSITIVE_KEY =
  /token|secret|pin|password|authorization|signature|cookie|signed_request|code_verifier/i

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]"
  if (value instanceof Error) {
    return { name: value.name, message: value.message }
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1)
    }
    return out
  }
  return value
}

function write(level: Level, msg: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...(redact(fields) as LogFields),
  })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.info(line)
}

export const log = {
  info: (msg: string, fields?: LogFields) => write("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => write("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => write("error", msg, fields),
}

export { redact as _redactForTest }
