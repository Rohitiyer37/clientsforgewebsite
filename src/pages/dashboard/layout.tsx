import { useEffect } from "react"
import { Navigate, Outlet, useLocation } from "react-router-dom"

import { PinScreen } from "@/dashboard/components/pin-screen"
import { DashboardShell, FullScreenLoader } from "@/dashboard/components/shell"
import { DashboardSessionProvider, useDashboardSession } from "@/dashboard/session"
import { ToastProvider } from "@/dashboard/toast"

/**
 * Wraps every /dashboard route. Signed out visitors see the PIN screen on
 * /dashboard itself; any deeper route sends them back to /dashboard. The real
 * enforcement is server side: every API resolves the session from the
 * httpOnly cookie, so this gate only decides what to render.
 */
export default function DashboardLayout() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = "Workspace | Clientsforge"
    const robots = document.createElement("meta")
    robots.name = "robots"
    robots.content = "noindex, nofollow"
    document.head.appendChild(robots)
    return () => {
      document.title = previousTitle
      robots.remove()
    }
  }, [])

  return (
    <ToastProvider>
      <DashboardSessionProvider>
        <Gate />
      </DashboardSessionProvider>
    </ToastProvider>
  )
}

function Gate() {
  const { status } = useDashboardSession()
  const { pathname } = useLocation()
  const atRoot = pathname.replace(/\/+$/, "") === "/dashboard"

  if (status === "loading") return <FullScreenLoader />
  if (status === "unauthenticated") {
    return atRoot ? <PinScreen /> : <Navigate to="/dashboard" replace />
  }
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  )
}
