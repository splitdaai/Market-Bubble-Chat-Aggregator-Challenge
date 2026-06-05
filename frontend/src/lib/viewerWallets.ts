/**
 * Maps a viewer to the EVM address they logged into Market Bubble with.
 *
 * In production these come from the backend (a viewer connects their wallet on
 * marketbubble.com to sign in, and the server tags their chat identity with the
 * address). Until that pipeline is live, demo mode derives a *stable* pseudo
 * address for a deterministic subset of viewers so the tip UX is fully clickable.
 */

/** Real viewer→address map, populated by the backend `accounts`/auth feed. */
const realWallets = new Map<string, string>();

export function setViewerWallet(name: string, address: string) {
  realWallets.set(name.toLowerCase(), address);
}

/** Deterministic 32-bit hash so the same name always yields the same result. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deriveAddress(name: string): string {
  // Expand the hash into 40 hex chars deterministically.
  let acc = "";
  let seed = hash(name);
  while (acc.length < 40) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    acc += seed.toString(16).padStart(8, "0");
  }
  return "0x" + acc.slice(0, 40);
}

/**
 * Returns the viewer's connected EVM address, or null if they haven't linked a
 * wallet. `demo` enables the deterministic stand-in for ~35% of viewers.
 */
export function viewerWallet(name: string, demo: boolean): string | null {
  const real = realWallets.get(name.toLowerCase());
  if (real) return real;
  if (!demo) return null;
  return hash(name + "::wallet") % 100 < 35 ? deriveAddress(name) : null;
}
