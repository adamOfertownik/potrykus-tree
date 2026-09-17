import type { Person } from "@/types/family";
import type {
  ChangeSubmission,
  GraphEditPayload,
} from "@/types/submissions";
import { displayName } from "@/lib/db-client";
import {
  GRAPH_OP_LABELS,
  KIND_LABELS,
  PERSON_FIELD_LABELS,
} from "@/lib/submissionLabels";
import { submissionGraphEdits } from "@/lib/applySubmission";

export const PERSON_HISTORY_NOTE =
  "Widoczne są tylko zaakceptowane zgłoszenia rodziny. Zmiany wpisane wprost przez administratora nie mają tu wpisu.";

export type PersonHistoryItem = {
  id: string;
  at: string;
  createdAt: string;
  reviewedAt?: string;
  kind: ChangeSubmission["kind"];
  kindLabel: string;
  headline: string;
  detail: string;
  reporterName: string;
  reporterPersonId?: string;
};

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ");
}

function personKey(first?: string, last?: string): string {
  return `${normalizeName(first ?? "")} ${normalizeName(last ?? "")}`.trim();
}

function samePersonName(
  a: { firstName?: string; lastName?: string },
  b: { firstName?: string; lastName?: string },
): boolean {
  const key = personKey(a.firstName, a.lastName);
  return Boolean(key) && key === personKey(b.firstName, b.lastName);
}

function addedNames(edits: GraphEditPayload[]): string[] {
  return edits
    .map((edit) => edit.newPerson)
    .filter((person): person is NonNullable<GraphEditPayload["newPerson"]> =>
      Boolean(person),
    )
    .map((person) => `${person.firstName} ${person.lastName}`.trim())
    .filter(Boolean);
}

export function submissionTouchesPerson(
  submission: ChangeSubmission,
  person: Person,
): boolean {
  if (submission.targetPersonId === person.id) return true;
  if (submission.before?.some((snapshot) => snapshot.id === person.id)) {
    return true;
  }
  if (submission.self && samePersonName(submission.self, person)) return true;
  if (submission.relatives?.some((relative) => samePersonName(relative, person))) {
    return true;
  }
  for (const edit of submissionGraphEdits(submission)) {
    if (edit.anchorPersonId === person.id) return true;
    if (edit.relatedPersonId === person.id) return true;
    if (edit.secondParentId === person.id) return true;
    if (edit.newPerson && samePersonName(edit.newPerson, person)) return true;
  }
  return false;
}

function describeHeadline(
  submission: ChangeSubmission,
  person: Person,
): { headline: string; detail: string } {
  const who = submission.reporterName;
  const edits = submissionGraphEdits(submission);
  const addedSelf =
    Boolean(submission.self && samePersonName(submission.self, person)) ||
    edits.some((edit) => edit.newPerson && samePersonName(edit.newPerson, person)) ||
    Boolean(
      submission.relatives?.some((relative) => samePersonName(relative, person)),
    );

  if (addedSelf) {
    const relative = submission.relatives?.find((item) =>
      samePersonName(item, person),
    );
    const edit = edits.find(
      (item) => item.newPerson && samePersonName(item.newPerson, person),
    );
    const detail =
      relative?.relation
        ? `Jako: ${relative.relation}.${submission.message ? ` ${submission.message}` : ""}`
        : edit?.summary ||
          submission.message ||
          "Nowa osoba z zaakceptowanego zgłoszenia.";
    return {
      headline: `${who} dodał(a) tę osobę`,
      detail: detail.trim(),
    };
  }

  const children = addedNames(
    edits.filter(
      (edit) => edit.op === "add_child" && edit.anchorPersonId === person.id,
    ),
  );
  if (children.length) {
    return {
      headline: `${who} dodał(a) ${children.length === 1 ? "dziecko" : "dzieci"}: ${children.join(", ")}`,
      detail: submission.message || "Zaakceptowane dodanie w drzewie.",
    };
  }

  const spouses = addedNames(
    edits.filter(
      (edit) =>
        edit.op === "link_spouse" &&
        (edit.anchorPersonId === person.id || edit.relatedPersonId === person.id),
    ),
  );
  if (spouses.length || edits.some((edit) => edit.op === "link_spouse")) {
    return {
      headline: spouses.length
        ? `${who} dodał(a) małżonka / partnera: ${spouses.join(", ")}`
        : `${who} zgłosił(a) małżeństwo / partnera`,
      detail: submission.message || "Zaakceptowane powiązanie.",
    };
  }

  if (edits.some((edit) => edit.op === "reparent")) {
    return {
      headline: `${who} zgłosił(a) przepisanie rodziców`,
      detail: submission.message || GRAPH_OP_LABELS.reparent,
    };
  }

  if (submission.kind === "photo") {
    return {
      headline:
        submission.photoAction === "remove"
          ? `${who} zgłosił(a) usunięcie zdjęcia`
          : `${who} dodał(a) zdjęcie`,
      detail: submission.message || KIND_LABELS.photo,
    };
  }

  if (submission.correction || submission.kind === "correction" || submission.kind === "dates") {
    const fields = submission.correction
      ? Object.keys(submission.correction)
          .map((field) => PERSON_FIELD_LABELS[field] || field)
          .filter(Boolean)
      : [];
    return {
      headline: `${who} poprawił(a) dane`,
      detail: fields.length
        ? `Pola: ${fields.join(", ")}.${submission.message ? ` ${submission.message}` : ""}`.trim()
        : submission.message || KIND_LABELS.correction,
    };
  }

  if (submission.kind === "missing_person") {
    return {
      headline: `${who} zgłosił(a) brakującą osobę`,
      detail: submission.message || KIND_LABELS.missing_person,
    };
  }

  return {
    headline: `${who} zgłosił(a) zmianę`,
    detail: submission.message || KIND_LABELS[submission.kind],
  };
}

export function describePersonHistory(
  submissions: ChangeSubmission[],
  person: Person,
  people: Person[] = [],
): PersonHistoryItem[] {
  const items: PersonHistoryItem[] = [];
  for (const submission of submissions) {
    if (submission.status !== "accepted") continue;
    if (!submissionTouchesPerson(submission, person)) continue;
    const { headline, detail } = describeHeadline(submission, person);
    const reporter =
      (submission.reporterPersonId &&
        people.find((p) => p.id === submission.reporterPersonId)) ||
      undefined;
    items.push({
      id: submission.id,
      at: submission.reviewedAt || submission.createdAt,
      createdAt: submission.createdAt,
      reviewedAt: submission.reviewedAt,
      kind: submission.kind,
      kindLabel: KIND_LABELS[submission.kind],
      headline,
      detail,
      reporterName: reporter ? displayName(reporter, people) : submission.reporterName,
      reporterPersonId: submission.reporterPersonId,
    });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items;
}
