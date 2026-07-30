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
    const raw = localStorage.getItem(REPORTER_KEY);
    if (!raw) {
      // migrate from older sessionStorage key if present
      const legacy = sessionStorage.getItem(REPORTER_KEY);
      if (legacy) {
        localStorage.setItem(REPORTER_KEY, legacy);
        sessionStorage.removeItem(REPORTER_KEY);
        return JSON.parse(legacy) as ReporterIdentity;
      }
      return null;
    }
    return JSON.parse(raw) as ReporterIdentity;
  } catch {
    return null;
  }
}

export function saveReporter(identity: ReporterIdentity) {
  localStorage.setItem(REPORTER_KEY, JSON.stringify(identity));
  try {
    sessionStorage.removeItem(REPORTER_KEY);
  } catch {
    /* ignore */
  }
}

export function clearReporter() {
  localStorage.removeItem(REPORTER_KEY);
  try {
    sessionStorage.removeItem(REPORTER_KEY);
  } catch {
    /* ignore */
  }
}
