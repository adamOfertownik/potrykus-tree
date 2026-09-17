"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { lockPageScroll } from "@/lib/scroll-lock";

type Props = {
  open: boolean;
  titleId?: string;
  labelledBy?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  cardClassName?: string;
  /** When true, backdrop click / Escape cannot dismiss */
  compulsory?: boolean;
};

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  titleId,
  labelledBy,
  onClose,
  children,
  className = "",
  cardClassName = "",
  compulsory = false,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const compulsoryRef = useRef(compulsory);
  const fallbackTitleId = useId();
  const label = labelledBy || titleId || fallbackTitleId;

  onCloseRef.current = onClose;
  compulsoryRef.current = compulsory;
  const ignoreBackdropUntil = useRef(0);

  const listFocusables = () => {
    const card = cardRef.current;
    if (!card) return [];
    return Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute("disabled"),
    );
  };

  useEffect(() => {
    if (!open) return;
    // Same tap that opened the modal still fires click on this backdrop
    // (especially on phones). Ignore it or the overlay opens and closes at once.
    ignoreBackdropUntil.current = performance.now() + 500;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const unlock = lockPageScroll();

    const preferred = cardRef.current?.querySelector<HTMLElement>(
      "input, select, textarea",
    );
    const first = preferred ?? listFocusables()[0];
    first?.focus();

    return () => {
      unlock();
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !compulsoryRef.current) {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = listFocusables();
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const onBackdrop = (e: ReactMouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (compulsory) return;
    if (performance.now() < ignoreBackdropUntil.current) return;
    onClose();
  };

  return createPortal(
    <div
      className={`modal-backdrop ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={label}
      onClick={onBackdrop}
    >
      <div
        ref={cardRef}
        className={`modal-card ${cardClassName}`.trim()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
