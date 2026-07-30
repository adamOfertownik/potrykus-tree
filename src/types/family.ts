export type Gender = "male" | "female" | "unknown";

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  maidenName?: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  photoUrl?: string;
  phone?: string;
  notes?: string;
  /** Parent person IDs (blood/adoptive parents) */
  parentIds: string[];
  /** Spouse / partner person IDs */
  spouseIds: string[];
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
}
