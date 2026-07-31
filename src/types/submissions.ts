export type ChangeKind =
  | "correction"
  | "missing_person"
  | "photo"
  | "dates"
  | "relatives"
  | "other";

export interface RelativeDraft {
  relation: string;
  firstName: string;
  lastName: string;
  maidenName?: string;
  birthDate?: string;
  deathDate?: string;
  notes?: string;
}

export interface ChangeSubmission {
  id: string;
  createdAt: string;
  kind: ChangeKind;
  /** Who is submitting */
  reporterName: string;
  reporterPersonId?: string;
  reporterPhone?: string;
  /** Target person if correcting existing */
  targetPersonId?: string;
  targetPersonName?: string;
  message: string;
  /** Self data when missing from tree */
  self?: {
    firstName: string;
    lastName: string;
    maidenName?: string;
    birthDate?: string;
    gender?: "male" | "female" | "unknown";
    phone?: string;
  };
  relatives?: RelativeDraft[];
  status: "new" | "reviewed" | "accepted" | "rejected" | "local_only";
}

export interface SubmissionPayload {
  kind: ChangeKind;
  reporterName: string;
  reporterPersonId?: string;
  reporterPhone?: string;
  targetPersonId?: string;
  targetPersonName?: string;
  message: string;
  self?: ChangeSubmission["self"];
  relatives?: RelativeDraft[];
}
