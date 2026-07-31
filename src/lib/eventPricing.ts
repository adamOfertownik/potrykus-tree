/** Pricing for the family gathering RSVP. */

export const DEFAULT_PRICE_PER_PERSON_PLN = 250;

export type GuestBreakdown = {
  adults: number;
  children3to12: number;
  childrenUnder3: number;
};

export function totalGuests(b: GuestBreakdown): number {
  return b.adults + b.children3to12 + b.childrenUnder3;
}

/** Paying places: adults + children aged 3–12. Under 3 are free. */
export function payingGuests(b: GuestBreakdown): number {
  return b.adults + b.children3to12;
}

export function amountDuePln(
  b: GuestBreakdown,
  pricePerPersonPln = DEFAULT_PRICE_PER_PERSON_PLN,
): number {
  return payingGuests(b) * pricePerPersonPln;
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
