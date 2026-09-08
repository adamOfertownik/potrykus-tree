"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

export type TextScaleId = "normal" | "large" | "xlarge";

const STORAGE_KEY = "potrykus_text_scale_v1";

const SCALE_VALUES: Record<TextScaleId, number> = {
  normal: 1,
  large: 1.18,
  xlarge: 1.32,
};

type Ctx = {
  scale: TextScaleId;
  setScale: (s: TextScaleId) => void;
};

const TextScaleContext = createContext<Ctx | null>(null);

function applyScale(scale: TextScaleId) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.textScale = scale;
  document.documentElement.style.setProperty(
    "--text-scale",
    String(SCALE_VALUES[scale]),
  );
}

function readStoredScale(): TextScaleId {
  if (typeof window === "undefined") return "normal";
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as TextScaleId | null;
    if (saved && saved in SCALE_VALUES) return saved;
  } catch {
    /* ignore */
  }
  return "normal";
}

let scaleSnapshot: TextScaleId = "normal";
const scaleListeners = new Set<() => void>();

function subscribeScale(listener: () => void) {
  scaleListeners.add(listener);
  return () => scaleListeners.delete(listener);
}

function emitScale() {
  for (const listener of scaleListeners) listener();
}

function getScaleSnapshot(): TextScaleId {
  scaleSnapshot = readStoredScale();
  return scaleSnapshot;
}

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const scale = useSyncExternalStore(
    subscribeScale,
    getScaleSnapshot,
    () => "normal" as TextScaleId,
  );

  useEffect(() => {
    applyScale(scale);
  }, [scale]);

  const setScale = (next: TextScaleId) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    scaleSnapshot = next;
    applyScale(next);
    emitScale();
  };

  return (
    <TextScaleContext.Provider value={{ scale, setScale }}>
      {children}
    </TextScaleContext.Provider>
  );
}

export function useTextScale() {
  const ctx = useContext(TextScaleContext);
  if (!ctx) {
    return {
      scale: "normal" as TextScaleId,
      setScale: () => {},
    };
  }
  return ctx;
}
