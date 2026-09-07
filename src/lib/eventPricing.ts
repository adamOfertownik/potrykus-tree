/** Pricing for the family gathering RSVP. */

export const DEFAULT_PRICE_PER_PERSON_PLN = 240;
export const DEFAULT_PRICE_CHILD_TO_7_PLN = 120;

export type GuestBreakdown = {
  adults: number;
  children3to12: number;
  childrenUnder3: number;
};

export type EventPrices = {
  adultPln?: number;
  childTo7Pln?: number;
};

export function totalGuests(b: GuestBreakdown): number {
  return b.adults + b.children3to12 + b.childrenUnder3;
}

/** Paying places: adults (8+) + children aged 3–7. Under 3 are free. */
export function payingGuests(b: GuestBreakdown): number {
  return b.adults + b.children3to12;
}

export function amountDuePln(
  b: GuestBreakdown,
  adultPln = DEFAULT_PRICE_PER_PERSON_PLN,
  childTo7Pln = DEFAULT_PRICE_CHILD_TO_7_PLN,
): number {
  return b.adults * adultPln + b.children3to12 * childTo7Pln;
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
  adults = 0,
  childrenTo7 = 0,
): string {
  return template
    .replaceAll("{name}", fullName.trim() || "Imię Nazwisko")
    .replaceAll("{guests}", String(guests))
    .replaceAll("{amount}", String(amount))
    .replaceAll("{adults}", String(adults))
    .replaceAll("{children}", String(childrenTo7));
}
