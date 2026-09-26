import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { UNAUTHORIZED_EVENT, api } from "./api"

export interface DashboardClient {
  id: string
  name: string
}

type Status = "loading" | "authenticated" | "unauthenticated"

interface SessionValue {
  status: Status
  client: DashboardClient | null
  signedIn: (client: DashboardClient) => void
  logout: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function DashboardSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading")
  const [client, setClient] = useState<DashboardClient | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    api<{ client: DashboardClient }>("/api/me", { signal: controller.signal })
      .then((res) => {
        setClient(res.client)
        setStatus("authenticated")
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return
        setClient(null)
        setStatus("unauthenticated")
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const onUnauthorized = () => {
      setClient(null)
      setStatus("unauthenticated")
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const signedIn = useCallback((next: DashboardClient) => {
    setClient(next)
    setStatus("authenticated")
  }, [])

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" })
    } finally {
      setClient(null)
      setStatus("unauthenticated")
    }
  }, [])

  const value = useMemo(
    () => ({ status, client, signedIn, logout }),
    [status, client, signedIn, logout],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useDashboardSession(): SessionValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useDashboardSession must be used inside DashboardSessionProvider")
  return ctx
}

/** Only for pages rendered after the gate, where a client always exists. */
export function useClient(): DashboardClient {
  const { client } = useDashboardSession()
  if (!client) throw new Error("useClient called without a signed in client")
  return client
}
