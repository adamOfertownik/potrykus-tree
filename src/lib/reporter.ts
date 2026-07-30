"use client";

const REPORTER_KEY = "potrykus_reporter_v1";

export type ReporterIdentity = {
  name: string;
  personId?: string;
};

export function loadReporter(): ReporterIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(REPORTER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReporterIdentity;
  } catch {
    return null;
  }
}

export function saveReporter(identity: ReporterIdentity) {
  sessionStorage.setItem(REPORTER_KEY, JSON.stringify(identity));
}

export function clearReporter() {
  sessionStorage.removeItem(REPORTER_KEY);
}
