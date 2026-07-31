"use client";

import { useEffect } from "react";

/**
 * Tear down any previously registered service workers.
 * The first SW (potrykus-v1) returned Response.error() and broke
 * the first navigation from / → /drzewo (Chrome ERR_FAILED).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const cleanup = async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {
        /* ignore */
      }
      try {
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch {
        /* ignore */
      }
      // One-shot update to the kill-switch script for clients that still have v1 controlling
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          updateViaCache: "none",
        });
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      } catch {
        /* ignore */
      }
    };

    if (document.readyState === "complete") void cleanup();
    else window.addEventListener("load", () => void cleanup());
  }, []);

  return null;
}
