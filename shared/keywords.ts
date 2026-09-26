/**
 * Keyword matching for comment triggers. Case insensitive and whole word:
 * "guide" matches "GUIDE!!", "the guide." and "#guide", but not "guides" or
 * "guidebook". Multi word keywords ("free guide") match as a phrase.
 * Keywords with no letters or digits (an emoji like "🔥") cannot be matched
 * by words, so they fall back to a plain substring match.
 */

const WORD = /[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu

/**
 * iOS Smart Punctuation turns ' into a curly apostrophe, so "don’t" typed on
 * an iPhone must match a keyword typed as "don't" on a laptop.
 */
function fold(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[‘’ʼ]/g, "'")
    .toLocaleLowerCase()
}

export function tokenize(input: string): string[] {
  return fold(input).match(WORD) ?? []
}

/**
 * Canonical form used for storage, dedupe, and the database overlap check.
 * It is exactly the word sequence the matcher compares, so two keywords that
 * match the same comments ("Guide!", "#guide", "guide") store identically.
 * Without that, the overlap rule would compare "guide!" to "guide", see two
 * different strings, and let two automations DM the same commenter.
 * Keywords with no words (an emoji) keep their folded, trimmed text.
 */
export function normalizeKeyword(keyword: string): string {
  const words = tokenize(keyword)
  if (words.length > 0) return words.join(" ")
  return fold(keyword).trim().replace(/\s+/g, " ")
}

export function matchesKeyword(comment: string, keyword: string): boolean {
  const needle = tokenize(keyword)
  if (needle.length === 0) {
    const raw = normalizeKeyword(keyword)
    return raw.length > 0 && fold(comment).includes(raw)
  }
  const words = tokenize(comment)
  outer: for (let i = 0; i + needle.length <= words.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (words[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

export type TriggerType = "any_comment" | "keywords"

export function matchesTrigger(
  comment: string,
  trigger: { triggerType: TriggerType; keywords: readonly string[] },
): boolean {
  if (trigger.triggerType === "any_comment") return true
  return trigger.keywords.some((k) => matchesKeyword(comment, k))
}
