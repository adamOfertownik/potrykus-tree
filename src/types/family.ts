export type Gender = "male" | "female" | "unknown";

/** One wedding with a specific spouse. Divorce is a flag, not a date. */
export interface Marriage {
  spouseId: string;
  weddingDate?: string;
  divorced?: boolean;
}

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  maidenName?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  /** First active (or first) wedding date — kept in sync with `marriages`. */
  weddingDate?: string;
  marriages?: Marriage[];
  photoUrl?: string;
  phone?: string;
  notes?: string;
  /** Parent person IDs (blood/adoptive parents) */
  parentIds: string[];
  /** Spouse / partner person IDs */
  spouseIds: string[];
  /** Client-only: staged locally, not yet accepted into the tree */
  pending?: boolean;
}

export interface FamilyDatabase {
  meta: {
    title: string;
    rootPersonId: string;
    creator: string;
    updatedAt: string;
    description: string;
  };
  people: Person[];
}

export interface FamilyConfig {
  accessCodeHash: string;
  sessionSecret: string;
  cookieName: string;
}

export type PersonPublic = Person & {
  childrenIds: string[];
};

export interface FamilyPayload {
  meta: FamilyDatabase["meta"];
  people: PersonPublic[];
  unlocked: boolean;
  /** People from the tree who RSVP'd to the family gathering */
  attendingPersonIds?: string[];
}
