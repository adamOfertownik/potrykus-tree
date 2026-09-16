import type { Gender } from "@/types/family";

export type ChangeKind =
  | "correction"
  | "missing_person"
  | "photo"
  | "dates"
  | "relatives"
  | "graph_edit"
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

export interface GraphEditPayload {
  op: "add_child" | "link_spouse" | "reparent";
  anchorPersonId: string;
  relatedPersonId?: string;
  secondParentId?: string;
  replaceParentIds?: boolean;
  newPerson?: {
    firstName: string;
    lastName: string;
    gender: "male" | "female" | "unknown";
    birthDate?: string;
    maidenName?: string;
  };
  summary?: string;
}

export interface PersonFieldPatch {
  firstName?: string;
  lastName?: string;
  maidenName?: string;
  gender?: Gender;
  birthDate?: string;
  deathDate?: string;
  phone?: string;
  notes?: string;
}

export interface PersonSnapshot {
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
  parentIds: string[];
  spouseIds: string[];
}

export interface FieldDiff {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface SubmissionPreview {
  summary: string;
  diffs: FieldDiff[];
  photoBefore?: string;
  photoAfter?: string;
  autoApply: boolean;
  warnings: string[];
}

export interface ChangeSubmission {
  id: string;
  createdAt: string;
  kind: ChangeKind;
  reporterName: string;
  reporterPersonId?: string;
  reporterPhone?: string;
  targetPersonId?: string;
  targetPersonName?: string;
  message: string;
  self?: {
    firstName: string;
    lastName: string;
    maidenName?: string;
    birthDate?: string;
    gender?: "male" | "female" | "unknown";
    phone?: string;
  };
  relatives?: RelativeDraft[];
  graphEdit?: GraphEditPayload;
  correction?: PersonFieldPatch;
  photoUrl?: string;
  photoAction?: "set" | "remove";
  before?: PersonSnapshot[];
  status: "new" | "reviewed" | "accepted" | "rejected" | "local_only";
  reviewedAt?: string;
  reviewedByAdminId?: string;
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
  graphEdit?: GraphEditPayload;
  correction?: PersonFieldPatch;
  photoUrl?: string;
  photoAction?: "set" | "remove";
}
