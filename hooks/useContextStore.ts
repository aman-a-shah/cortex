"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContextEntry } from "@/types";

export function useContextStore(pollIntervalMs = 3000) {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [latest, setLatest] = useState<ContextEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/context");
      if (!res.ok) return;
      const data: ContextEntry[] = await res.json();
      setEntries((prev) => {
        const newestId = data[0]?.id;
        const prevNewestId = prev[0]?.id;
        if (newestId && newestId !== prevNewestId && prev.length > 0) {
          setLatest(data[0]);
        }
        return data;
      });
    } catch {
      // silently fail — demo is resilient
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    const interval = setInterval(fetchEntries, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchEntries, pollIntervalMs]);

  const addEntry = useCallback(
    async (
      entry: Omit<ContextEntry, "id" | "createdAt" | "tokenCount">
    ): Promise<ContextEntry | null> => {
      try {
        const res = await fetch("/api/context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        if (!res.ok) return null;
        const created: ContextEntry = await res.json();
        setEntries((prev) => [created, ...prev]);
        setLatest(created);
        return created;
      } catch {
        return null;
      }
    },
    []
  );

  return { entries, latest, loading, addEntry, refresh: fetchEntries };
}
