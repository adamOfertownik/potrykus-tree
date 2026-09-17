"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LEGAL_STORAGE_KEY,
  LEGAL_VERSION,
  parseLegalAccept,
} from "@/lib/legal";

export function TermsAccept({
  id,
  accepted,
  onChange,
}: {
  id: string;
  accepted: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="gate-accept" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={accepted}
        required
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        Akceptuję{" "}
        <Link href="/regulamin" target="_blank" rel="noreferrer">
          regulamin
        </Link>{" "}
        i{" "}
        <Link href="/polityka-prywatnosci" target="_blank" rel="noreferrer">
          politykę prywatności
        </Link>
        . Wiem, że to prywatne archiwum rodziny, a nie usługa publiczna.
      </span>
    </label>
  );
}

/** Restore a previous acceptance of the current legal version. */
export function useStoredLegalAccept(): [boolean, (next: boolean) => void] {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setAccepted(Boolean(parseLegalAccept(localStorage.getItem(LEGAL_STORAGE_KEY))));
  }, []);

  const update = (next: boolean) => {
    setAccepted(next);
    if (next) {
      localStorage.setItem(
        LEGAL_STORAGE_KEY,
        JSON.stringify({ version: LEGAL_VERSION, at: new Date().toISOString() }),
      );
    } else {
      localStorage.removeItem(LEGAL_STORAGE_KEY);
    }
  };

  return [accepted, update];
}
