"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";

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
  const fallbackTitleId = useId();
  const label = labelledBy || titleId || fallbackTitleId;

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const card = cardRef.current;
    const focusables = () =>
      card
        ? Array.from(
            card.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];

    const first = focusables()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !compulsory) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !card) return;
      const items = focusables();
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
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [open, compulsory, onClose]);

  if (!open || typeof document === "undefined") return null;

  const onBackdrop = (e: ReactMouseEvent) => {
    if (e.target !== e.currentTarget) return;
    if (!compulsory) onClose();
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
