"use client";

/**
 * Nested modals + React Strict Mode remounts used to save/restore
 * `overflow: hidden` as the previous value, leaving the document stuck.
 * Count locks instead and always clear both html and body when the last
 * overlay closes.
 */
let lockCount = 0;

function applyLock() {
  const html = document.documentElement;
  const body = document.body;
  html.classList.add("is-scroll-locked");
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
}

function applyUnlock() {
  const html = document.documentElement;
  const body = document.body;
  html.classList.remove("is-scroll-locked");
  html.style.overflow = "";
  body.style.overflow = "";
}

export function lockPageScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  lockCount += 1;
  if (lockCount === 1) applyLock();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) applyUnlock();
  };
}

/** Drop a leftover inline lock when no modal is on screen (e.g. after navigation). */
export function resetPageScrollLockIfIdle() {
  if (typeof document === "undefined") return;
  if (document.querySelector(".modal-backdrop")) return;
  lockCount = 0;
  applyUnlock();
}
