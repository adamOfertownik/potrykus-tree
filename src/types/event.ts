export interface EventTransfer {
  recipient: string;
  iban: string;
  bank: string;
  titleTemplate: string;
  amountHint: string;
  notes: string;
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
  guests: number;
  notes?: string;
  willTransfer: boolean;
  status: "local_only";
}

export interface RsvpPayload {
  fullName: string;
  personId?: string;
  phone?: string;
  guests: number;
  notes?: string;
  willTransfer: boolean;
}
