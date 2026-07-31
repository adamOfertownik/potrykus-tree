"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // Pick up the fixed worker ASAP (replaces potrykus-v1 that could ERR_FAILED)
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch {
        /* private mode / unsupported */
      }
    };

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register());
  }, []);

  return null;
}
