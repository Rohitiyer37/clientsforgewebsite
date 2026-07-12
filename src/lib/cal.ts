// Cal.com element-click embed.
// Initializes the Cal loader once, then any element carrying CAL_ATTRS opens
// the booking popup on click.

const NAMESPACE = "discover-call-with-rohit"
const CAL_LINK = "rohit-iyer-jzuqiv/discover-call-with-rohit"

let initialized = false

export function initCalEmbed() {
  if (initialized || typeof window === "undefined") return
  initialized = true

  /* eslint-disable */
  ;(function (C: any, A: string, L: string) {
    const p = function (a: any, ar: any) {
      a.q.push(ar)
    }
    const d = C.document
    C.Cal =
      C.Cal ||
      function () {
        const cal = C.Cal
        const ar = arguments
        if (!cal.loaded) {
          cal.ns = {}
          cal.q = cal.q || []
          d.head.appendChild(d.createElement("script")).src = A
          cal.loaded = true
        }
        if (ar[0] === L) {
          const api: any = function () {
            p(api, arguments)
          }
          const namespace = ar[1]
          api.q = api.q || []
          if (typeof namespace === "string") {
            cal.ns[namespace] = cal.ns[namespace] || api
            p(cal.ns[namespace], ar)
            p(cal, ["initNamespace", namespace])
          } else p(cal, ar)
          return
        }
        p(cal, ar)
      }
  })(window, "https://app.cal.com/embed/embed.js", "init")
  /* eslint-enable */

  const Cal = (window as any).Cal
  Cal("init", NAMESPACE, { origin: "https://app.cal.com" })
  Cal.config = Cal.config || {}
  Cal.config.forwardQueryParams = true
  Cal.ns[NAMESPACE]("ui", {
    hideEventTypeDetails: false,
    layout: "month_view",
  })
}

/** Spread onto any element to make it open the booking popup on click. */
export const CAL_ATTRS: Record<string, string> = {
  "data-cal-namespace": NAMESPACE,
  "data-cal-link": CAL_LINK,
  "data-cal-config": '{"layout":"month_view","useSlotsViewOnSmallScreen":"true"}',
}
