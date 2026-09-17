"use client";

import type { GuestBreakdown } from "@/lib/eventPricing";
import { formatPln } from "@/lib/eventPricing";

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="guest-stepper">
      <div className="guest-stepper__text">
        <span className="guest-stepper__label">{label}</span>
        {hint ? <span className="guest-stepper__hint">{hint}</span> : null}
      </div>
      <div className="guest-stepper__controls">
        <button
          type="button"
          className="guest-stepper__btn"
          aria-label={`Mniej: ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <strong aria-live="polite">{value}</strong>
        <button
          type="button"
          className="guest-stepper__btn"
          aria-label={`Więcej: ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function GuestTicketSteppers({
  value,
  onChange,
  pricePerPersonPln,
  priceUnder7Pln,
}: {
  value: GuestBreakdown;
  onChange: (next: GuestBreakdown) => void;
  pricePerPersonPln: number;
  priceUnder7Pln: number;
}) {
  const set = (key: keyof GuestBreakdown, n: number) =>
    onChange({ ...value, [key]: n });

  return (
    <div className="guest-steppers">
      <Stepper
        label="Dorośli"
        hint={formatPln(pricePerPersonPln)}
        value={value.adults}
        min={0}
        max={20}
        onChange={(n) => set("adults", n)}
      />
      <Stepper
        label="Dzieci do 7 roku życia"
        hint={formatPln(priceUnder7Pln)}
        value={value.children3to12}
        min={0}
        max={20}
        onChange={(n) => set("children3to12", n)}
      />
      <Stepper
        label="Dzieci do lat 3"
        hint="0 zł"
        value={value.childrenUnder3}
        min={0}
        max={20}
        onChange={(n) => set("childrenUnder3", n)}
      />
    </div>
  );
}
