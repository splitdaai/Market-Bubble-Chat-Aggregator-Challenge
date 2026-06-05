import { useMemo } from "react";
import { useConnectionsStore } from "@/store/connectionsStore";
import { activePlatforms } from "@/lib/accounts";

/** Reactive list of platforms that currently have a connected account. */
export function useActivePlatforms() {
  const accounts = useConnectionsStore((s) => s.accounts);
  return useMemo(() => activePlatforms(accounts), [accounts]);
}
