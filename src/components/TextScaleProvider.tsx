"use client";

import { createContext, useContext, useEffect, useState } from "react";

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

export function TextScaleProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState<TextScaleId>("normal");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as TextScaleId | null;
      if (saved && saved in SCALE_VALUES) {
        setScaleState(saved);
        applyScale(saved);
        return;
      }
    } catch {
      /* ignore */
    }
    applyScale("normal");
  }, []);

  const setScale = (next: TextScaleId) => {
    setScaleState(next);
    applyScale(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
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
      setScale: (_: TextScaleId) => {},
    };
  }
  return ctx;
}
