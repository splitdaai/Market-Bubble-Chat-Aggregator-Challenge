import { useEffect, useRef } from "react";
import { BACKEND_URL } from "../lib/socket";

type VisitKind = "pageview" | "view" | "heartbeat" | "leave";

const SESSION_KEY = "mb_visit_session";
const MAX_PARAM = 160;

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = randomId();
    sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return randomId();
  }
}

function siteFromHost(hostname: string) {
  if (hostname === "marketbubble-khaki.vercel.app") return "khaki";
  if (hostname === "marketbubble-live-preview.s3-website-us-east-1.amazonaws.com") return "aws";
  if (hostname === "marketbubble.chat" || hostname === "www.marketbubble.chat") return "marketbubble";
  if (hostname === "3-213-104-77.nip.io") return "backend";
  if (hostname === "localhost" || hostname === "127.0.0.1") return "local";
  return "unknown";
}

function safePath() {
  const keys = new URLSearchParams(window.location.search);
  const redacted = [...keys.keys()].slice(0, 8).map((key) => `${encodeURIComponent(key)}=1`);
  return `${window.location.pathname}${redacted.length ? `?${redacted.join("&")}` : ""}`.slice(0, MAX_PARAM);
}

function buildVisitUrl(kind: VisitKind, view: string) {
  if (!BACKEND_URL) return null;
  const params = new URLSearchParams({
    kind,
    site: siteFromHost(window.location.hostname),
    host: window.location.hostname.slice(0, MAX_PARAM),
    path: safePath(),
    view: view.slice(0, 48),
    sid: sessionId().slice(0, 96),
    sw: String(Math.round(window.screen?.width || 0)),
    sh: String(Math.round(window.screen?.height || 0)),
  });
  return `${BACKEND_URL}/api/visit?${params.toString()}`;
}

function sendVisit(kind: VisitKind, view: string) {
  const url = buildVisitUrl(kind, view);
  if (!url) return;

  if (navigator.sendBeacon?.(url)) return;

  const img = new Image();
  img.decoding = "async";
  img.referrerPolicy = "strict-origin-when-cross-origin";
  img.src = url;
}

export function useTrafficBeacon(view: string) {
  const lastView = useRef<string | null>(null);

  useEffect(() => {
    sendVisit("pageview", view);
  }, []);

  useEffect(() => {
    if (lastView.current === view) return;
    if (lastView.current !== null) sendVisit("view", view);
    lastView.current = view;
  }, [view]);

  useEffect(() => {
    const heartbeat = window.setInterval(() => sendVisit("heartbeat", view), 60_000);
    const leave = () => sendVisit("leave", view);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave();
    };

    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [view]);
}
