export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** Fired on any 401, so the dashboard drops back to the PIN screen at once. */
export const UNAUTHORIZED_EVENT = "cf:unauthorized"

interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  body?: unknown
  signal?: AbortSignal
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options
  let res: Response
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw new ApiError(0, "You appear to be offline. Check your connection and try again.")
  }

  const contentType = res.headers.get("content-type") ?? ""
  const data: unknown = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : null

  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    const payload = (data ?? {}) as { error?: string; code?: string }
    throw new ApiError(
      res.status,
      payload.error ?? "Something went wrong. Please try again.",
      payload.code,
    )
  }

  if (data === null) {
    throw new ApiError(res.status, "The server returned an unexpected response.")
  }
  return data as T
}
