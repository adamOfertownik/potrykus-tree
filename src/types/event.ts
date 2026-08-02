export interface EventTransfer {
  recipient: string;
  iban: string;
  bank: string;
  titleTemplate: string;
  amountHint: string;
  notes: string;
}

export interface EventAmenity {
  id: string;
  title: string;
  detail: string;
}

export interface EventScheduleItem {
  time: string;
  title: string;
  detail: string;
}

export interface FamilyEvent {
  title: string;
  date: string;
  dateLabel: string;
  place: string;
  city: string;
  address?: string;
  description: string;
  organizers: string[];
  pricePerPersonPln: number;
  /** Already registered outside the app (shown in stats) */
  registeredCount: number;
  /** Max people for the gathering */
  capacity: number;
  amenities: EventAmenity[];
  schedule: EventScheduleItem[];
  transfer: EventTransfer;
  rsvpDeadline?: string;
  contactNote?: string;
}

export interface EventRsvp {
  id: string;
  createdAt: string;
  fullName: string;
  personId?: string;
  phone?: string;
  /** Total people (adults + children) */
  guests: number;
  adults: number;
  children3to12: number;
  childrenUnder3: number;
  amountPln: number;
  notes?: string;
  willTransfer: boolean;
  status: "new" | "confirmed" | "cancelled" | "local_only";
}

export interface RsvpPayload {
  fullName: string;
  personId?: string;
  phone?: string;
  adults: number;
  children3to12: number;
  childrenUnder3: number;
  notes?: string;
  willTransfer: boolean;
}
