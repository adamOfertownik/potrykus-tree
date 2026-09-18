import { displayName } from "@/lib/db-client";
import {
  addStandalonePerson,
  applyGraphMutations,
  patchPerson,
  remapGraphMutationIds,
  summarizeMutationPreview,
  type GraphMutationInput,
} from "@/lib/familyMutations";
import type { GraphEditPayload } from "@/types/submissions";
import { genderLabel, PERSON_FIELD_LABELS } from "@/lib/submissionLabels";
import type { FamilyDatabase, Person } from "@/types/family";
import { formatMarriagesForDiff } from "@/lib/marriages";
import type {
  ChangeSubmission,
  FieldDiff,
  PersonFieldPatch,
  PersonSnapshot,
  SubmissionPreview,
} from "@/types/submissions";

function cloneDb(db: FamilyDatabase): FamilyDatabase {
  return JSON.parse(JSON.stringify(db)) as FamilyDatabase;
}

function formatValue(field: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field === "gender" && typeof value === "string") return genderLabel(value);
  if (field === "marriages") {
    return formatMarriagesForDiff(
      Array.isArray(value) ? value : undefined,
      (id) => id,
    );
  }
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

function findByName(people: Person[], first: string, last: string): Person | undefined {
  const f = first.trim().toLowerCase();
  const l = last.trim().toLowerCase();
  return people.find(
    (p) =>
      p.firstName.trim().toLowerCase() === f &&
      p.lastName.trim().toLowerCase() === l,
  );
}

function relationKind(relation: string): "parent" | "child" | "spouse" | "none" {
  const r = relation.toLowerCase();
  if (/(rodzic|mama|tata|ojciec|matka)/.test(r)) return "parent";
  if (/(dziecko|syn|c[oó]rka)/.test(r)) return "child";
  if (/(ma[łl][zż]onek|żona|maz|mąż|partner)/.test(r)) return "spouse";
  return "none";
}

function patchDiffs(
  current: Person | PersonSnapshot | undefined,
  patch: PersonFieldPatch,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const [field, after] of Object.entries(patch) as [
    keyof PersonFieldPatch,
    string | undefined,
  ][]) {
    if (after === undefined) continue;
    const before = current ? current[field as keyof typeof current] : undefined;
    const beforeText = formatValue(field, before);
    const afterText = formatValue(field, after);
    if (beforeText === afterText) continue;
    diffs.push({
      field,
      label: PERSON_FIELD_LABELS[field] || field,
      before: beforeText,
      after: afterText,
    });
  }
  return diffs;
}

export function submissionGraphEdits(
  submission: Pick<ChangeSubmission, "graphEdit" | "graphEdits">,
): GraphEditPayload[] {
  if (submission.graphEdits?.length) return submission.graphEdits;
  return submission.graphEdit ? [submission.graphEdit] : [];
}

function toMutationInput(edit: GraphEditPayload): GraphMutationInput {
  return {
    op: edit.op,
    anchorPersonId: edit.anchorPersonId,
    relatedPersonId: edit.relatedPersonId,
    newPerson: edit.newPerson,
    secondParentId: edit.secondParentId,
    replaceParentIds: edit.replaceParentIds,
    weddingDate: edit.weddingDate,
  };
}

export function canAutoApply(submission: ChangeSubmission): boolean {
  if (submissionGraphEdits(submission).length) return true;
  if (submission.kind === "photo") return Boolean(submission.targetPersonId);
  if (submission.correction && submission.targetPersonId) return true;
  if (submission.kind === "dates" && submission.correction && submission.targetPersonId) {
    return true;
  }
  if (submission.kind === "missing_person" && submission.self) return true;
  return false;
}

export function previewSubmission(
  db: FamilyDatabase,
  submission: ChangeSubmission,
): SubmissionPreview {
  const warnings: string[] = [];
  const diffs: FieldDiff[] = [];
  let summary = submission.message?.trim() || "Sugestia zmiany w drzewie.";
  let autoApply = canAutoApply(submission);
  let photoBefore: string | undefined;
  let photoAfter: string | undefined;

  const graphEdits = submissionGraphEdits(submission);
  if (graphEdits.length) {
    try {
      const result = applyGraphMutations(
        db,
        graphEdits.map(toMutationInput),
      );
      summary = result.summaries.join(" ");
      for (const person of result.createdPeople) {
        diffs.push({
          field: "firstName",
          label: "Nowa osoba",
          before: "—",
          after: displayName(person),
        });
      }
    } catch (err) {
      autoApply = false;
      warnings.push(
        err instanceof Error ? err.message : "Nie można zastosować zmiany grafu.",
      );
      if (graphEdits.length === 1) {
        summary = summarizeMutationPreview(db.people, graphEdits[0]);
      }
    }
  }

  if (submission.correction && submission.targetPersonId) {
    const person = db.people.find((p) => p.id === submission.targetPersonId);
    if (!person) {
      autoApply = false;
      warnings.push("Osoba z zgłoszenia nie istnieje już w drzewie.");
    } else {
      diffs.push(...patchDiffs(person, submission.correction));
      summary = `Poprawka danych: ${displayName(person)}.`;
    }
  }

  if (submission.kind === "photo" && submission.targetPersonId) {
    const person = db.people.find((p) => p.id === submission.targetPersonId);
    photoBefore = person?.photoUrl;
    if (submission.photoAction === "remove") {
      photoAfter = undefined;
      summary = person
        ? `Usunąć zdjęcie: ${displayName(person)}?`
        : "Usunąć zdjęcie.";
    } else {
      photoAfter = submission.photoUrl;
      summary = person
        ? `Nowe zdjęcie: ${displayName(person)}.`
        : "Nowe zdjęcie.";
    }
    if (!person) {
      autoApply = false;
      warnings.push("Osoba ze zdjęcia nie istnieje w drzewie.");
    }
  }

  if (submission.kind === "missing_person" && submission.self) {
    summary = `Dodać osobę: ${submission.self.firstName} ${submission.self.lastName}.`;
    diffs.push({
      field: "firstName",
      label: "Nowa osoba",
      before: "—",
      after: `${submission.self.firstName} ${submission.self.lastName}`,
    });
  }

  if (!autoApply && diffs.length === 0 && !graphEdits.length && !photoAfter && submission.photoAction !== "remove") {
    warnings.push(
      "Brak automatycznego zapisu — zaakceptowanie tylko oznaczy zgłoszenie. Użyj zakładki Osoby, żeby wprowadzić zmianę ręcznie.",
    );
  }

  return { summary, diffs, photoBefore, photoAfter, autoApply, warnings };
}

export function selectSubmissionParts(
  submission: ChangeSubmission,
  opts: { graphEditIndexes?: number[]; correctionFields?: string[] },
): ChangeSubmission {
  const allEdits = submissionGraphEdits(submission);
  const edits =
    opts.graphEditIndexes != null
      ? [...opts.graphEditIndexes]
          .sort((a, b) => a - b)
          .map((i) => allEdits[i])
          .filter(Boolean)
      : opts.correctionFields != null
        ? []
        : allEdits;
  let correction = submission.correction;
  if (opts.correctionFields != null) {
    const next: PersonFieldPatch = {};
    for (const field of opts.correctionFields) {
      if (!correction || !(field in correction)) continue;
      Object.assign(next, {
        [field]: correction[field as keyof PersonFieldPatch],
      });
    }
    correction = Object.keys(next).length ? next : undefined;
  } else if (opts.graphEditIndexes != null) {
    correction = undefined;
  }
  return {
    ...submission,
    graphEdit: edits[0],
    graphEdits: edits.length > 1 ? edits : undefined,
    correction,
    photoUrl: opts.graphEditIndexes || opts.correctionFields
      ? undefined
      : submission.photoUrl,
    photoAction: opts.graphEditIndexes || opts.correctionFields
      ? undefined
      : submission.photoAction,
  };
}

export function leftoverSubmission(
  submission: ChangeSubmission,
  opts: {
    dropGraphIndexes: number[];
    dropFields: string[];
    idMap?: Record<string, string>;
  },
): ChangeSubmission | null {
  const allEdits = submissionGraphEdits(submission);
  const dropEdits = new Set(opts.dropGraphIndexes);
  const leftoverEdits = allEdits
    .filter((_, i) => !dropEdits.has(i))
    .map((edit) => {
      if (!opts.idMap) return edit;
      const mapped = remapGraphMutationIds(toMutationInput(edit), opts.idMap);
      return { ...edit, ...mapped };
    });

  let correction = submission.correction;
  if (correction && opts.dropFields.length) {
    const next = { ...correction };
    for (const field of opts.dropFields) {
      delete next[field as keyof PersonFieldPatch];
    }
    correction = Object.keys(next).length ? next : undefined;
  }

  if (!leftoverEdits.length && !correction) return null;

  return {
    ...submission,
    graphEdit: leftoverEdits[0],
    graphEdits: leftoverEdits.length > 1 ? leftoverEdits : undefined,
    correction,
  };
}

export function applySubmission(
  source: FamilyDatabase,
  submission: ChangeSubmission,
): { db: FamilyDatabase; summary: string; createdPersonId?: string; idMap: Record<string, string> } {
  if (!canAutoApply(submission)) {
    return {
      db: source,
      summary: "Zgłoszenie oznaczone jako zaakceptowane (bez automatycznego zapisu drzewa).",
      idMap: {},
    };
  }

  let db = cloneDb(source);
  let summary = submission.message || "Zastosowano zmianę.";
  let createdPersonId: string | undefined;
  let idMap: Record<string, string> = {};

  const graphEdits = submissionGraphEdits(submission);
  if (graphEdits.length) {
    const result = applyGraphMutations(
      db,
      graphEdits.map(toMutationInput),
    );
    db = result.db;
    summary = result.summary;
    createdPersonId = result.createdPeople.at(-1)?.id;
    idMap = result.idMap;
  }

  if (submission.correction && submission.targetPersonId) {
    db = patchPerson(db, submission.targetPersonId, submission.correction);
    const person = db.people.find((p) => p.id === submission.targetPersonId);
    summary = person
      ? `Zaktualizowano dane: ${displayName(person)}.`
      : summary;
  }

  if (submission.kind === "photo" && submission.targetPersonId) {
    const person = db.people.find((p) => p.id === submission.targetPersonId);
    if (!person) throw new Error("Nie znaleziono osoby do zdjęcia.");
    if (submission.photoAction === "remove") {
      db = patchPerson(db, person.id, { photoUrl: "" });
      summary = `Usunięto zdjęcie: ${displayName(person)}.`;
    } else if (submission.photoUrl) {
      db = patchPerson(db, person.id, { photoUrl: submission.photoUrl });
      summary = `Ustawiono zdjęcie: ${displayName(person)}.`;
    }
  }

  if (submission.kind === "missing_person" && submission.self) {
    const created = addStandalonePerson(db, {
      firstName: submission.self.firstName,
      lastName: submission.self.lastName,
      maidenName: submission.self.maidenName,
      gender: submission.self.gender ?? "unknown",
      birthDate: submission.self.birthDate,
      phone: submission.self.phone,
    });
    db = created.db;
    createdPersonId = created.person.id;

    for (const rel of submission.relatives ?? []) {
      if (!rel.firstName?.trim() || !rel.lastName?.trim()) continue;
      let related = findByName(db.people, rel.firstName, rel.lastName);
      if (!related) {
        const extra = addStandalonePerson(db, {
          firstName: rel.firstName,
          lastName: rel.lastName,
          maidenName: rel.maidenName,
          gender: "unknown",
          birthDate: rel.birthDate,
          notes: rel.notes,
        });
        db = extra.db;
        related = extra.person;
      }
      const kind = relationKind(rel.relation);
      const selfPerson = db.people.find((p) => p.id === created.person.id)!;
      if (kind === "parent" && !selfPerson.parentIds.includes(related.id)) {
        selfPerson.parentIds.push(related.id);
      } else if (kind === "child" && !related.parentIds.includes(selfPerson.id)) {
        related.parentIds.push(selfPerson.id);
      } else if (kind === "spouse") {
        if (!selfPerson.spouseIds.includes(related.id)) {
          selfPerson.spouseIds.push(related.id);
        }
        if (!related.spouseIds.includes(selfPerson.id)) {
          related.spouseIds.push(selfPerson.id);
        }
      }
    }

    summary = `Dodano ${displayName(created.person)} do drzewa.`;
  }

  return { db, summary, createdPersonId, idMap };
}
