import type { Person } from "@/types/family";
import type { ChangeSubmission } from "@/types/submissions";
import { displayName } from "@/lib/db-client";
import { describeKinship, type KinshipResult } from "@/lib/kinship";

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ");
}

export function resolvePersonByName(
  people: Person[],
  name: string | undefined,
): Person | undefined {
  const want = normalizeName(name ?? "");
  if (!want) return undefined;
  const hits = people.filter((person) => {
    const full = normalizeName(`${person.firstName} ${person.lastName}`);
    const shown = normalizeName(displayName(person, people));
    const maiden = person.maidenName
      ? normalizeName(`${person.firstName} ${person.maidenName}`)
      : "";
    return want === full || want === shown || (maiden && want === maiden);
  });
  return hits.length === 1 ? hits[0] : undefined;
}

export function submissionTargetPersonId(submission: ChangeSubmission): string | undefined {
  if (submission.targetPersonId) return submission.targetPersonId;
  const edit = submission.graphEdits?.[0] ?? submission.graphEdit;
  return edit?.anchorPersonId;
}

export type SubmissionKinshipNote = {
  kind: KinshipResult["kind"] | "missing-reporter" | "missing-target";
  sentence: string;
  reverse?: string;
  relation?: string;
};

export function describeSubmissionKinship(
  people: Person[],
  submission: ChangeSubmission,
): SubmissionKinshipNote | null {
  const targetId = submissionTargetPersonId(submission);
  const target =
    (targetId && people.find((p) => p.id === targetId)) ||
    resolvePersonByName(people, submission.targetPersonName);
  if (!target) {
    return submission.targetPersonName
      ? {
          kind: "missing-target",
          sentence: `Dotyczy: ${submission.targetPersonName}.`,
        }
      : null;
  }

  const reporter =
    (submission.reporterPersonId &&
      people.find((p) => p.id === submission.reporterPersonId)) ||
    resolvePersonByName(people, submission.reporterName);

  const reporterName = reporter
    ? displayName(reporter, people)
    : submission.reporterName;
  const targetName = displayName(target, people);

  if (!reporter) {
    return {
      kind: "missing-reporter",
      sentence: `${reporterName} nie jest wskazana na drzewie — nie wiadomo, kim jest ${targetName} dla niej.`,
    };
  }

  if (reporter.id === target.id) {
    return {
      kind: "self",
      sentence: `${reporterName} poprawia własne dane.`,
      relation: "siebie",
    };
  }

  const kin = describeKinship(people, reporter.id, target.id);
  if (kin.kind === "none") {
    return {
      kind: "none",
      sentence: `W drzewie nie ma znanego pokrewieństwa: ${reporterName} poprawia ${targetName}.`,
    };
  }

  return {
    kind: kin.kind,
    relation: kin.labelBtoA,
    sentence: `Dla ${reporterName} to ${kin.labelBtoA} (${targetName}).`,
    reverse: `Dla ${targetName} zgłaszająca osoba to ${kin.labelAtoB}.`,
  };
}
