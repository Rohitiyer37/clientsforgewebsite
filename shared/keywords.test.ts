import { describe, expect, it } from "vitest"

import { matchesKeyword, matchesTrigger, normalizeKeyword, tokenize } from "./keywords"

describe("keyword matching: case", () => {
  it.each([
    ["guide", "guide"],
    ["GUIDE", "guide"],
    ["Guide", "gUiDe"],
    ["send me the GUIDE please", "guide"],
  ])("%s matches %s", (comment, keyword) => {
    expect(matchesKeyword(comment, keyword)).toBe(true)
  })

  it("folds Unicode compatibility forms (full width letters)", () => {
    expect(matchesKeyword("ＧＵＩＤＥ", "guide")).toBe(true)
  })
})

describe("keyword matching: punctuation", () => {
  it.each([
    "guide!",
    "guide!!!",
    "(guide)",
    "guide?",
    "“guide”",
    "guide...",
    "#guide",
    "guide,please",
    "yes-guide-yes",
  ])("finds the keyword in %s", (comment) => {
    expect(matchesKeyword(comment, "guide")).toBe(true)
  })

  it("ignores punctuation inside the keyword itself", () => {
    expect(matchesKeyword("send the guide", "guide!")).toBe(true)
    expect(matchesKeyword("send the guide", "#guide")).toBe(true)
  })

  it("keeps apostrophes inside words", () => {
    expect(matchesKeyword("I don't know", "don't")).toBe(true)
    expect(tokenize("I don't know")).toEqual(["i", "don't", "know"])
  })

  it("treats iPhone curly apostrophes the same as straight ones", () => {
    expect(matchesKeyword("I don’t know", "don't")).toBe(true)
    expect(matchesKeyword("I don't know", "don’t")).toBe(true)
    expect(matchesKeyword("what’s the link", "what's")).toBe(true)
  })
})

describe("keyword matching: whole words", () => {
  it.each([
    ["guides", "guide"],
    ["guidebook", "guide"],
    ["misguided", "guide"],
    ["reguide", "guide"],
    ["infoguide", "info"],
  ])("%s does not match %s", (comment, keyword) => {
    expect(matchesKeyword(comment, keyword)).toBe(false)
  })

  it("matches multi word keywords as a phrase, in order", () => {
    expect(matchesKeyword("can I get the free guide?", "free guide")).toBe(true)
    expect(matchesKeyword("FREE   GUIDE", "free guide")).toBe(true)
    expect(matchesKeyword("free-guide", "free guide")).toBe(true)
    expect(matchesKeyword("guide free", "free guide")).toBe(false)
    expect(matchesKeyword("free the guide", "free guide")).toBe(false)
  })

  it("matches numbers as words", () => {
    expect(matchesKeyword("send me 2026 plan", "2026")).toBe(true)
    expect(matchesKeyword("send me 20260 plan", "2026")).toBe(false)
  })
})

describe("keyword matching: emoji and edge cases", () => {
  it("falls back to substring for keywords with no letters or digits", () => {
    expect(matchesKeyword("love this 🔥🔥", "🔥")).toBe(true)
    expect(matchesKeyword("love this", "🔥")).toBe(false)
  })

  it("never matches an empty keyword", () => {
    expect(matchesKeyword("anything", "")).toBe(false)
    expect(matchesKeyword("anything", "   ")).toBe(false)
  })

  it("handles non Latin scripts", () => {
    expect(matchesKeyword("मुझे गाइड चाहिए", "गाइड")).toBe(true)
    expect(matchesKeyword("Привет, ГАЙД!", "гайд")).toBe(true)
  })
})

describe("triggers", () => {
  it("any_comment matches everything, including empty text", () => {
    expect(matchesTrigger("", { triggerType: "any_comment", keywords: [] })).toBe(true)
  })

  it("keywords matches when any keyword matches", () => {
    const t = { triggerType: "keywords" as const, keywords: ["guide", "link"] }
    expect(matchesTrigger("drop the LINK", t)).toBe(true)
    expect(matchesTrigger("nice reel", t)).toBe(false)
  })

  it("normalizes keywords for storage", () => {
    expect(normalizeKeyword("  Free   GUIDE ")).toBe("free guide")
  })

  it("stores keywords that match the same comments identically", () => {
    // The database overlap rule compares stored keywords, so these must
    // collapse to one form or two automations could DM the same person.
    for (const k of ["guide", "Guide!", "#guide", "GUIDE?!", " (guide) "]) {
      expect(normalizeKeyword(k)).toBe("guide")
    }
    expect(normalizeKeyword("free-guide")).toBe("free guide")
    expect(normalizeKeyword("don’t")).toBe("don't")
  })

  it("keeps emoji keywords usable after normalizing", () => {
    expect(normalizeKeyword(" 🔥 ")).toBe("🔥")
    expect(matchesKeyword("so good 🔥", normalizeKeyword(" 🔥 "))).toBe(true)
  })

  it("matches exactly the same comments before and after normalizing", () => {
    const comments = ["GUIDE!", "the guide.", "guides", "free-guide pls", "nothing"]
    for (const k of ["Guide!", "#free-guide", "free guide"]) {
      for (const c of comments) {
        expect(matchesKeyword(c, normalizeKeyword(k))).toBe(matchesKeyword(c, k))
      }
    }
  })
})
