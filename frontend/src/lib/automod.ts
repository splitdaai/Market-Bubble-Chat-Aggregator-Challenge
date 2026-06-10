/**
 * Client-side auto-moderation for the unified chat — a defensive safety filter so
 * hosts and viewers aren't exposed to toxic content. Two tiers:
 *   - BLOCK: hard slurs (racist / homophobic / etc.) → the message is dropped.
 *   - MASK:  general profanity / toxicity → the offending word is censored.
 * Leetspeak- and separator-tolerant (matched on a normalized token), so common
 * evasions like "n1gg3r" or "f.a.g" are still caught. Not a replacement for
 * platform moderation — a first line of defense.
 */

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", $: "s", "!": "i" };

/** Normalize a token: lowercase, de-leet, strip non-letters, collapse runs. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[0134578@$!]/g, (c) => LEET[c] ?? c).replace(/[^a-z]/g, "").replace(/(.)\1{2,}/g, "$1$1");
}

// Hard slurs → drop the whole message.
const BLOCK = ["nigger", "nigga", "faggot", "fag", "retard", "tranny", "chink", "spic", "kike", "coon", "dyke", "wetback", "beaner", "gook", "raghead", "paki", "groid"].map(norm);
// General profanity / toxicity → mask the word, keep the message.
const MASK = ["fuck", "shit", "bitch", "cunt", "asshole", "bastard", "dick", "pussy", "slut", "whore", "scammer", "kys"].map(norm);

/** True if the message contains a hard slur or a self-harm directive. */
export function isBlocked(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bkys\b/.test(lower) || /kill\s*your\s*self/.test(lower)) return true;
  return text.split(/\s+/).some((w) => BLOCK.includes(norm(w)));
}

/** Censor any profane/slur token while leaving the rest of the message intact. */
export function maskText(text: string): string {
  return text.replace(/\S+/g, (w) => {
    const n = norm(w);
    return n && (MASK.includes(n) || BLOCK.includes(n)) ? "•".repeat(Math.max(3, w.length)) : w;
  });
}

/** Run a message through auto-mod. `blocked` → caller should drop it. */
export function moderate(text: string): { text: string; blocked: boolean } {
  if (isBlocked(text)) return { text, blocked: true };
  return { text: maskText(text), blocked: false };
}
