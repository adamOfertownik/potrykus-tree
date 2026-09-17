/** Pricing for the family gathering RSVP. */

export const DEFAULT_PRICE_PER_PERSON_PLN = 240;
export const DEFAULT_EVENT_CAPACITY = 200;
export const EARLY_ARRIVAL_OVER_7_PLN = 100;
export const EARLY_ARRIVAL_UNDER_7_PLN = 50;

export type GuestBreakdown = {
  adults: number;
  children3to12: number;
  childrenUnder3: number;
};

export type EarlyArrivalBreakdown = {
  earlyArrival: boolean;
  earlyArrivalOver7: number;
  earlyArrivalUnder7: number;
};

export function totalGuests(b: GuestBreakdown): number {
  return b.adults + b.children3to12 + b.childrenUnder3;
}

/** Paying places: adults + children aged 3–12. Under 3 are free. */
export function payingGuests(b: GuestBreakdown): number {
  return b.adults + b.children3to12;
}

export function earlyArrivalSurchargePln(
  early?: Partial<EarlyArrivalBreakdown> | null,
): number {
  if (!early?.earlyArrival) return 0;
  const over7 = Math.max(0, early.earlyArrivalOver7 ?? 0);
  const under7 = Math.max(0, early.earlyArrivalUnder7 ?? 0);
  return over7 * EARLY_ARRIVAL_OVER_7_PLN + under7 * EARLY_ARRIVAL_UNDER_7_PLN;
}

export function amountDuePln(
  b: GuestBreakdown,
  pricePerPersonPln = DEFAULT_PRICE_PER_PERSON_PLN,
  early?: Partial<EarlyArrivalBreakdown> | null,
): number {
  return payingGuests(b) * pricePerPersonPln + earlyArrivalSurchargePln(early);
}

export function formatPln(amount: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildTransferTitle(
  template: string,
  fullName: string,
  guests: number,
  amount: number,
): string {
  return template
    .replaceAll("{name}", fullName.trim() || "Imię Nazwisko")
    .replaceAll("{guests}", String(guests))
    .replaceAll("{amount}", String(amount));
}
