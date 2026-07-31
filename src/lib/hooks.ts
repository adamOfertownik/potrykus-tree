"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyPayload } from "@/types/family";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Błąd sieci");
  }
  return data as T;
}

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: () =>
      fetchJson<{ unlocked: boolean; storage?: "neon" | "file" }>(
        "/api/auth/status",
      ),
  });
}

export function useFamily(enabled = true) {
  return useQuery({
    queryKey: ["family"],
    queryFn: () => fetchJson<FamilyPayload>("/api/family"),
    retry: false,
    enabled,
  });
}

export function useUnlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      fetchJson<{ ok: boolean }>("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth-status"] });
      await qc.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      qc.removeQueries({ queryKey: ["family"] });
      await qc.invalidateQueries({ queryKey: ["auth-status"] });
    },
  });
}
