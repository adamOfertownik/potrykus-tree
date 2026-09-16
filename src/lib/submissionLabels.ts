import type { ChangeKind, ChangeSubmission } from "@/types/submissions";

export const KIND_LABELS: Record<ChangeKind, string> = {
  correction: "Poprawka danych",
  missing_person: "Brakująca osoba",
  photo: "Zdjęcie",
  dates: "Daty",
  relatives: "Powiązania",
  graph_edit: "Zmiana w drzewie",
  other: "Inne",
};

export const STATUS_LABELS: Record<ChangeSubmission["status"], string> = {
  new: "Nowe",
  reviewed: "Przejrzane",
  accepted: "Zaakceptowane",
  rejected: "Odrzucone",
  local_only: "Tylko lokalnie",
};

export const PERSON_FIELD_LABELS: Record<string, string> = {
  firstName: "Imię",
  lastName: "Nazwisko",
  maidenName: "Nazwisko rodowe",
  gender: "Płeć",
  birthDate: "Data urodzenia",
  deathDate: "Data zgonu",
  phone: "Telefon",
  notes: "Notatki",
  photoUrl: "Zdjęcie",
  parentIds: "Rodzice",
  spouseIds: "Partnerzy",
};

export function genderLabel(value?: string): string {
  if (value === "male") return "mężczyzna";
  if (value === "female") return "kobieta";
  if (value === "unknown") return "nieznana";
  return value || "—";
}
