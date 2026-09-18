"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FamilyPayload } from "@/types/family";
import type { AdminUserRole } from "@/types/admin";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Błąd sieci");
  }
  return data as T;
}

export type FamilyAuthStatus = {
  unlocked: boolean;
  remember?: boolean;
  storage?: "neon" | "file";
};

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth-status"],
    queryFn: () =>
      fetchJson<FamilyAuthStatus>("/api/auth/status", { cache: "no-store" }),
  });
}

export function useFamily(enabled = true) {
  return useQuery({
    queryKey: ["family"],
    queryFn: () =>
      fetchJson<FamilyPayload>("/api/family", { cache: "no-store" }),
    retry: false,
    enabled,
  });
}

export function useUnlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { code: string; remember?: boolean }) =>
      fetchJson<{ ok: boolean; remember?: boolean }>("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: async (data) => {
      qc.setQueryData(["auth-status"], {
        unlocked: true,
        remember: data.remember === true,
      });
      await qc.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ ok: boolean }>("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      }),
    onSuccess: () => {
      qc.setQueryData(["auth-status"], { unlocked: false });
      qc.removeQueries({ queryKey: ["family"] });
      window.location.assign("/");
    },
  });
}

export type AdminAuthStatus = {
  loggedIn: boolean;
  email: string | null;
  role: AdminUserRole | null;
  adminId: string | null;
};

export function useAdminAuthStatus() {
  return useQuery({
    queryKey: ["admin-auth-status"],
    queryFn: () =>
      fetchJson<AdminAuthStatus>("/api/auth/admin/status", {
        cache: "no-store",
      }),
  });
}

export function useAdminLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      fetchJson<{ ok: boolean; email: string }>("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-auth-status"] });
    },
  });
}

export function useAdminLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ ok: boolean }>("/api/auth/admin/logout", {
        method: "POST",
        cache: "no-store",
      }),
    onSuccess: () => {
      qc.setQueryData(["admin-auth-status"], {
        loggedIn: false,
        email: null,
        role: null,
        adminId: null,
      });
      window.location.assign("/login");
    },
  });
}
