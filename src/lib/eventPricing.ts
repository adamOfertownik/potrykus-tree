/** Pricing for the family gathering RSVP. */

export const DEFAULT_PRICE_PER_PERSON_PLN = 240;
export const DEFAULT_PRICE_UNDER_7_PLN = 120;
export const DEFAULT_EVENT_CAPACITY = 200;
export const EARLY_ARRIVAL_OVER_7_PLN = 100;
export const EARLY_ARRIVAL_UNDER_7_PLN = 50;
export const EVENT_DATE_ISO = "2026-10-03";

export type GuestAgeGroup = "over7" | "under7" | "under3";

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

/** Paying places: 7+ and children up to 7. Under 3 are free. */
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
  priceUnder7Pln = DEFAULT_PRICE_UNDER_7_PLN,
): number {
  return (
    b.adults * pricePerPersonPln +
    b.children3to12 * priceUnder7Pln +
    earlyArrivalSurchargePln(early)
  );
}

export function formatPln(amount: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Bank title required by the organizers. */
export function buildTransferTitle(
  adults: number,
  childrenUnder7: number,
  names: string,
): string {
  const who = names.trim() || "Imię Nazwisko";
  return `IMPREZA RODZINNA, dorosłych- ${adults} dzieci do lat 7- ${childrenUnder7}. za: ${who}`;
}

export function ageOnEventDate(
  birthDate?: string,
  eventDate = EVENT_DATE_ISO,
): number | null {
  if (!birthDate || !/^\d{4}/.test(birthDate)) return null;
  const parts = birthDate.split("-");
  const by = Number(parts[0]);
  const bm = parts[1] ? Number(parts[1]) : 1;
  const bd = parts[2] ? Number(parts[2]) : 1;
  if (!by) return null;
  const ev = eventDate.split("-").map(Number);
  let age = ev[0] - by;
  if (ev[1] < bm || (ev[1] === bm && ev[2] < bd)) age -= 1;
  return age;
}

export function ageGroupFromBirth(birthDate?: string): GuestAgeGroup {
  const age = ageOnEventDate(birthDate);
  if (age == null) return "over7";
  if (age < 3) return "under3";
  if (age <= 7) return "under7";
  return "over7";
}

export function breakdownFromAgeGroups(
  groups: GuestAgeGroup[],
): GuestBreakdown {
  const adults = groups.filter((g) => g === "over7").length;
  const children3to12 = groups.filter((g) => g === "under7").length;
  const childrenUnder3 = groups.filter((g) => g === "under3").length;
  return { adults, children3to12, childrenUnder3 };
}
