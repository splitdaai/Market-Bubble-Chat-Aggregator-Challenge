import { useEffect, useState } from "react";

const QUERY = "(max-width: 768px)";

/**
 * True on phone-sized viewports. Drives the dedicated mobile shell so the
 * desktop dashboard is never touched. Updates live on resize/rotate.
 */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const on = () => setMobile(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}
