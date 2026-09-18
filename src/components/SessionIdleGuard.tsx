"use client";

import { useEffect, useRef, useState } from "react";
import {
  useAdminAuthStatus,
  useAdminLogout,
  useAuthStatus,
  useLogout,
} from "@/lib/hooks";
import {
  ADMIN_IDLE_MS,
  FAMILY_IDLE_MS,
  IDLE_WARN_MS,
} from "@/lib/sessionPolicy";

const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "touchstart",
] as const;

function useIdleTimer(opts: {
  enabled: boolean;
  idleMs: number;
  onIdle: () => void;
}) {
  const lastActive = useRef(Date.now());
  const warned = useRef(false);
  const onIdleRef = useRef(opts.onIdle);
  onIdleRef.current = opts.onIdle;
  const [warnVisible, setWarnVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!opts.enabled) {
      setWarnVisible(false);
      return;
    }

    lastActive.current = Date.now();
    warned.current = false;
    setWarnVisible(false);

    const bump = () => {
      lastActive.current = Date.now();
      warned.current = false;
      setWarnVisible(false);
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, bump, { passive: true });
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisible);

    const tick = window.setInterval(() => {
      const idleFor = Date.now() - lastActive.current;
      const remaining = opts.idleMs - idleFor;
      if (remaining <= 0) {
        onIdleRef.current();
        return;
      }
      if (remaining <= IDLE_WARN_MS && !warned.current) {
        warned.current = true;
        setWarnVisible(true);
      }
      if (warned.current) {
        setSecondsLeft(Math.max(1, Math.ceil(remaining / 1000)));
      }
    }, 1000);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, bump);
      }
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(tick);
    };
  }, [opts.enabled, opts.idleMs]);

  return { warnVisible, secondsLeft };
}

export function SessionIdleGuard() {
  const auth = useAuthStatus();
  const admin = useAdminAuthStatus();
  const logout = useLogout();
  const adminLogout = useAdminLogout();
  const [notice, setNotice] = useState<string | null>(null);

  const familyShort =
    auth.data?.unlocked === true && auth.data.remember === false;
  const adminLoggedIn = admin.data?.loggedIn === true;

  const familyIdle = useIdleTimer({
    enabled: familyShort && !logout.isPending,
    idleMs: FAMILY_IDLE_MS,
    onIdle: () => logout.mutate(),
  });

  const adminIdle = useIdleTimer({
    enabled: adminLoggedIn && !adminLogout.isPending,
    idleMs: ADMIN_IDLE_MS,
    onIdle: () => adminLogout.mutate(),
  });

  const warnVisible = familyIdle.warnVisible || adminIdle.warnVisible;
  const secondsLeft = adminIdle.warnVisible
    ? adminIdle.secondsLeft
    : familyIdle.secondsLeft;

  useEffect(() => {
    if (!warnVisible) {
      setNotice(null);
      return;
    }
    if (adminIdle.warnVisible) {
      setNotice(
        `Brak aktywności — za ${secondsLeft} s wylogujemy z panelu admina.`,
      );
      return;
    }
    setNotice(
      `Długo Cię nie było — za ${secondsLeft} s poprosimy ponownie o kod rodzinny.`,
    );
  }, [warnVisible, secondsLeft, adminIdle.warnVisible]);

  if (!notice) return null;

  return (
    <div className="session-idle-notice" role="status" aria-live="polite">
      {notice}
    </div>
  );
}
