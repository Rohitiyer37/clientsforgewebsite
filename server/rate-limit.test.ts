import { describe, expect, it } from "vitest"

import {
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_MS,
  isLoginAllowed,
  type AttemptStore,
} from "./rate-limit"

/** In memory store with a controllable clock, mirroring the Supabase store. */
function memoryStore(clock: { now: number }) {
  const attempts: { ip: string; at: number; success: boolean }[] = []
  const store: AttemptStore = {
    async countFailuresSince(ip, since) {
      return attempts.filter(
        (a) => a.ip === ip && !a.success && a.at >= since.getTime(),
      ).length
    },
    async record(ip, success) {
      attempts.push({ ip, at: clock.now, success })
    },
  }
  return store
}

async function fail(store: AttemptStore, ip: string, times: number) {
  for (let i = 0; i < times; i++) await store.record(ip, false)
}

describe("PIN rate limiting", () => {
  it("allows the first five failures and blocks the sixth attempt", async () => {
    const clock = { now: Date.UTC(2026, 0, 1) }
    const store = memoryStore(clock)
    const at = () => new Date(clock.now)

    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      expect(await isLoginAllowed(store, "1.1.1.1", at())).toBe(true)
      await store.record("1.1.1.1", false)
    }
    expect(await isLoginAllowed(store, "1.1.1.1", at())).toBe(false)
  })

  it("does not count successful logins against the limit", async () => {
    const clock = { now: Date.UTC(2026, 0, 1) }
    const store = memoryStore(clock)
    for (let i = 0; i < 20; i++) await store.record("1.1.1.1", true)
    expect(await isLoginAllowed(store, "1.1.1.1", new Date(clock.now))).toBe(true)
  })

  it("limits per IP, so one IP cannot lock out another", async () => {
    const clock = { now: Date.UTC(2026, 0, 1) }
    const store = memoryStore(clock)
    await fail(store, "1.1.1.1", 10)
    expect(await isLoginAllowed(store, "1.1.1.1", new Date(clock.now))).toBe(false)
    expect(await isLoginAllowed(store, "2.2.2.2", new Date(clock.now))).toBe(true)
  })

  it("unblocks once the failures age out of the 15 minute window", async () => {
    const clock = { now: Date.UTC(2026, 0, 1) }
    const store = memoryStore(clock)
    await fail(store, "1.1.1.1", LOGIN_MAX_FAILURES)
    expect(await isLoginAllowed(store, "1.1.1.1", new Date(clock.now))).toBe(false)

    const justInside = clock.now + LOGIN_WINDOW_MS - 1000
    expect(await isLoginAllowed(store, "1.1.1.1", new Date(justInside))).toBe(false)

    const justOutside = clock.now + LOGIN_WINDOW_MS + 1000
    expect(await isLoginAllowed(store, "1.1.1.1", new Date(justOutside))).toBe(true)
  })

  it("slides: only failures inside the window count", async () => {
    const clock = { now: Date.UTC(2026, 0, 1) }
    const store = memoryStore(clock)
    await fail(store, "1.1.1.1", 3)
    clock.now += 10 * 60 * 1000
    await fail(store, "1.1.1.1", 2)
    // Five failures, all inside the window.
    expect(await isLoginAllowed(store, "1.1.1.1", new Date(clock.now))).toBe(false)
    // Six minutes later the first three have aged out, leaving two.
    clock.now += 6 * 60 * 1000
    expect(await isLoginAllowed(store, "1.1.1.1", new Date(clock.now))).toBe(true)
  })
})
