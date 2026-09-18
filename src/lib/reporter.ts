"use client";

const REPORTER_KEY = "potrykus_reporter_v1";

export type ReporterIdentity = {
  name: string;
  personId?: string;
};

/** Persists across visits on this device (cheap “to ja”). */
export function loadReporter(): ReporterIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(REPORTER_KEY) ||
      sessionStorage.getItem(REPORTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReporterIdentity;
    if (!parsed?.name && !parsed?.personId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveReporter(identity: ReporterIdentity) {
  const raw = JSON.stringify(identity);
  try {
    localStorage.setItem(REPORTER_KEY, raw);
  } catch {
    /* private mode */
  }
  try {
    sessionStorage.setItem(REPORTER_KEY, raw);
  } catch {
    /* ignore */
  }
}

export function clearReporter() {
  try {
    localStorage.removeItem(REPORTER_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(REPORTER_KEY);
  } catch {
    /* ignore */
  }
}
