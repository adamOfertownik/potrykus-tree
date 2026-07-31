"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore — private mode / unsupported */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
  }, []);

  return null;
}
