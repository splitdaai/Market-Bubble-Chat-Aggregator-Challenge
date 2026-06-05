import type { Platform } from "@shared/types";

/**
 * Resolve a viewer's avatar URL.
 *
 * For X users we fetch their real profile picture by handle via unavatar.io
 * (a public avatar resolver) — so "@handle" shows the actual X PFP. Other
 * platforms fall back to whatever avatar the message carried, else null so the
 * caller renders a colored initial.
 */
export function avatarUrl(
  name: string,
  platform: Platform,
  messageAvatar?: string,
): string | null {
  if (messageAvatar) return messageAvatar;
  if (platform === "x") {
    const handle = name.replace(/^@/, "").trim();
    if (handle) return `https://unavatar.io/x/${encodeURIComponent(handle)}`;
  }
  return null;
}
