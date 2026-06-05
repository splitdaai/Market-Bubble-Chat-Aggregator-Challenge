/**
 * Tiny, fast chat-sentiment lexicon. Not NLP — tuned for *livestream* chat
 * slang where "W", "L", "based", "ratio", emotes etc. carry the signal. Returns
 * a score in roughly [-1, 1]. The backend can override with a real model later.
 */

const POS = [
  "w", "ww", "pog", "poggers", "pogchamp", "lets go", "letsgo", "lfg", "gg", "ggs",
  "based", "fire", "lit", "goated", "goat", "king", "queen", "love", "amazing",
  "insane", "clean", "cracked", "hype", "banger", "nice", "respect", "legend",
  "🔥", "🚀", "💜", "❤", "😂", "🤣", "💪", "🎉", "✨", "👑", "lol", "lmao", "haha",
];

const NEG = [
  "l", "ll", "trash", "boring", "cringe", "ratio", "mid", "bad", "worst", "yikes",
  "cope", "sad", "rip", "scam", "fake", "stop", "quit", "hate", "ugh", "meh",
  "💀", "🤡", "😭", "👎", "💩", "L+ratio", "fell off", "washed",
];

const HYPE = ["raid", "host", "donat", "cheer", "bits", "sub", "gift", "tier"];

/** Score a single message. */
export function scoreMessage(text: string): number {
  const t = ` ${text.toLowerCase()} `;
  let score = 0;
  for (const w of POS) if (t.includes(` ${w} `) || t.includes(w)) score += 1;
  for (const w of NEG) if (t.includes(` ${w} `) || t.includes(w)) score -= 1;
  for (const w of HYPE) if (t.includes(w)) score += 1.5;
  // Exclamation energy + caps shouting nudge positive/intensity.
  if (/!{2,}/.test(text)) score += 0.5;
  return Math.max(-3, Math.min(4, score));
}

/** Map a rolling average in ~[-1,1] to a human mood label. */
export function moodLabel(avg: number): { label: string; emoji: string } {
  if (avg >= 0.6) return { label: "Going Off", emoji: "🚀" };
  if (avg >= 0.25) return { label: "Hyped", emoji: "🔥" };
  if (avg >= 0.05) return { label: "Positive", emoji: "😄" };
  if (avg > -0.05) return { label: "Chill", emoji: "😌" };
  if (avg > -0.25) return { label: "Restless", emoji: "😬" };
  return { label: "Spicy", emoji: "🌶️" };
}
