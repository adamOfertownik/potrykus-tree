"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyPayload } from "@/types/family";
import type { AuthRole, UserRole } from "@/types/auth";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Błąd sieci");
  }
  return data as T;
}

export type AuthStatus = {
  unlocked: boolean;
  role: AuthRole | null;
  email: string | null;
  storage?: "neon" | "file";
  needsFirstAdmin?: boolean;
  missingTables?: boolean;
};

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: () => fetchJson<AuthStatus>("/api/auth/status"),
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

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      fetchJson<{ ok: boolean; email: string; role: UserRole }>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth-status"] });
      await qc.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

export function useFirstAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      displayName?: string;
    }) =>
      fetchJson<{ ok: boolean; email: string; role: UserRole }>("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth-status"] });
      await qc.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      inviteCode: string;
      displayName?: string;
    }) =>
      fetchJson<{ ok: boolean; email: string; role: UserRole }>(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["auth-status"] });
      await qc.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

export function useViewUnlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      fetchJson<{ ok: boolean; role: "guest" }>("/api/auth/view", {
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
