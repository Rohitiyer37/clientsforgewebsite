import { describe, expect, it } from "vitest"

import {
  InvalidRangeError,
  addDays,
  dateInZone,
  daysInclusive,
  metaDayWindow,
  previousPeriod,
  resolveRange,
  startOfDayInZone,
} from "./dates"

describe("date math", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01")
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
    expect(daysInclusive("2026-09-01", "2026-09-30")).toBe(30)
  })

  it("finds the calendar date in a time zone", () => {
    // 20:00 UTC is already the next day in India.
    const instant = new Date("2026-09-27T20:00:00Z")
    expect(dateInZone(instant, "Asia/Kolkata")).toBe("2026-09-28")
    expect(dateInZone(instant, "America/Los_Angeles")).toBe("2026-09-27")
  })

  it("finds midnight in a zone, across daylight saving", () => {
    expect(startOfDayInZone("2026-09-28", "Asia/Kolkata").toISOString()).toBe(
      "2026-09-27T18:30:00.000Z",
    )
    // Pacific Daylight Time (UTC-7) and Standard Time (UTC-8).
    expect(startOfDayInZone("2026-07-01", "America/Los_Angeles").toISOString()).toBe(
      "2026-07-01T07:00:00.000Z",
    )
    expect(startOfDayInZone("2026-12-01", "America/Los_Angeles").toISOString()).toBe(
      "2026-12-01T08:00:00.000Z",
    )
  })

  it("builds a Meta day window, including the 23 hour spring forward day", () => {
    const normal = metaDayWindow("2026-09-01")
    expect(normal.until - normal.since).toBe(86400)
    const spring = metaDayWindow("2026-03-08")
    expect(spring.until - spring.since).toBe(23 * 3600)
  })
})

describe("previousPeriod", () => {
  it("is the same length, immediately before", () => {
    expect(previousPeriod({ from: "2026-09-01", to: "2026-09-30" })).toEqual({
      from: "2026-08-02",
      to: "2026-08-31",
      days: 30,
    })
  })

  it("works for a one day custom range", () => {
    expect(previousPeriod({ from: "2026-03-01", to: "2026-03-01" })).toEqual({
      from: "2026-02-28",
      to: "2026-02-28",
      days: 1,
    })
  })

  it("works for an arbitrary custom range", () => {
    expect(previousPeriod({ from: "2026-09-10", to: "2026-09-19" })).toEqual({
      from: "2026-08-31",
      to: "2026-09-09",
      days: 10,
    })
  })
})

describe("resolveRange", () => {
  // 06:00 UTC is 11:30 in India, so "today" there is 2026-09-28.
  const now = new Date("2026-09-28T06:00:00Z")
  const tz = "Asia/Kolkata"

  it("defaults to the last 30 days ending yesterday", () => {
    expect(resolveRange({}, { tz, now, minDate: null })).toEqual({
      from: "2026-08-29",
      to: "2026-09-27",
      days: 30,
      preset: "30d",
    })
  })

  it("resolves each preset", () => {
    expect(resolveRange({ range: "7d" }, { tz, now, minDate: null }).from).toBe("2026-09-21")
    expect(resolveRange({ range: "90d" }, { tz, now, minDate: null }).days).toBe(90)
  })

  it("clamps a custom range to stored data and to yesterday", () => {
    expect(
      resolveRange({ from: "2026-01-01", to: "2026-12-31" }, { tz, now, minDate: "2026-07-01" }),
    ).toEqual({ from: "2026-07-01", to: "2026-09-27", days: 89, preset: null })
  })

  it("rejects a custom range entirely before stored data", () => {
    expect(() =>
      resolveRange({ from: "2026-10-01", to: "2026-10-05" }, { tz, now, minDate: null }),
    ).toThrow(InvalidRangeError)
  })
})
