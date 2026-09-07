"use client";

import { useMemo, useState } from "react";
import type { Gender, PersonPublic } from "@/types/family";
import type { RelativeDraft, SubmissionPayload } from "@/types/submissions";
import type { NewPersonInput } from "@/lib/familyMutations";
import { searchPeople } from "@/lib/search";
import { displayName } from "@/lib/db-client";
import { saveReporter } from "@/lib/reporter";
import { postGraphMutation } from "@/lib/graphClient";

type Props = {
  people: PersonPublic[];
  isAdmin: boolean;
  /** Called once onboarding is done or skipped — parent navigates to the tree. */
  onFinish: () => void;
};

type Phase =
  | "search"
  | "onTree"
  | "offSelf"
  | "offParent"
  | "offGrandparent"
  | "offReview";

type ParentEdit = {
  personId: string;
  firstName: string;
  lastName: string;
  maidenName: string;
  birthDate: string;
};

type RelativePick = {
  key: string;
  mode: "existing" | "new";
  picked: PersonPublic | null;
  query: string;
  newPerson: NewPersonInput;
};

function emptyNewPerson(): NewPersonInput {
  return { firstName: "", lastName: "", gender: "unknown" };
}

function makeRelativePick(): RelativePick {
  return {
    key: Math.random().toString(36).slice(2),
    mode: "existing",
    picked: null,
    query: "",
    newPerson: emptyNewPerson(),
  };
}

async function submitChange(payload: SubmissionPayload) {
  const res = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Nie udało się zapisać zgłoszenia.");
  return data;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  return {
    firstName: parts[0] || full.trim(),
    lastName: parts.slice(1).join(" "),
  };
}

function StepHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <header className="onboarding-head">
      <p className="onboarding-eyebrow">{eyebrow}</p>
      <h1 className="onboarding-title">{title}</h1>
      <p className="onboarding-lead">{lead}</p>
    </header>
  );
}

export function OnboardingWizard({ people, isAdmin, onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>("search");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  // — step: search self —
  const [query, setQuery] = useState("");
  const [self, setSelf] = useState<PersonPublic | null>(null);

  // — on-tree relations —
  const [parentEdits, setParentEdits] = useState<ParentEdit[]>([]);
  const [missingParentName, setMissingParentName] = useState("");
  const [wantsSpouse, setWantsSpouse] = useState(false);
  const [spouse, setSpouse] = useState<RelativePick>(() => makeRelativePick());
  const [children, setChildren] = useState<RelativePick[]>([]);

  // — off-tree self + ancestor search chain —
  const [selfDraft, setSelfDraft] = useState({
    firstName: "",
    lastName: "",
    maidenName: "",
    birthDate: "",
    gender: "unknown" as Gender,
    phone: "",
  });
  const [parentQuery, setParentQuery] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentMatch, setParentMatch] = useState<PersonPublic | null>(null);
  const [grandparentQuery, setGrandparentQuery] = useState("");
  const [grandparentName, setGrandparentName] = useState("");
  const [grandparentMatch, setGrandparentMatch] = useState<PersonPublic | null>(
    null,
  );
  const [extraNote, setExtraNote] = useState("");

  const matches = useMemo(
    () => (query.trim() ? searchPeople(people, query).slice(0, 8) : []),
    [people, query],
  );
  const parentMatches = useMemo(
    () =>
      parentQuery.trim() ? searchPeople(people, parentQuery).slice(0, 6) : [],
    [people, parentQuery],
  );
  const grandparentMatches = useMemo(
    () =>
      grandparentQuery.trim()
        ? searchPeople(people, grandparentQuery).slice(0, 6)
        : [],
    [people, grandparentQuery],
  );

  const skip = () => onFinish();

  const pickSelf = (p: PersonPublic) => {
    setSelf(p);
    setError(null);
    saveReporter({ name: displayName(p), personId: p.id });
    setParentEdits(
      p.parentIds.map((id) => {
        const parent = people.find((x) => x.id === id);
        return {
          personId: id,
          firstName: parent?.firstName || "",
          lastName: parent?.lastName || "",
          maidenName: parent?.maidenName || "",
          birthDate: parent?.birthDate || "",
        };
      }),
    );
    setPhase("onTree");
  };

  const goOffTree = () => {
    setSelf(null);
    setError(null);
    const guess = splitName(query);
    setSelfDraft((d) => ({ ...d, ...guess }));
    setPhase("offSelf");
  };

  const updateParentEdit = (personId: string, patch: Partial<ParentEdit>) => {
    setParentEdits((rows) =>
      rows.map((r) => (r.personId === personId ? { ...r, ...patch } : r)),
    );
  };

  const updateRelative = (
    list: RelativePick[],
    setList: (rows: RelativePick[]) => void,
    key: string,
    patch: Partial<RelativePick>,
  ) => {
    setList(list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const relativePicker = (
    label: string,
    picked: RelativePick,
    onChange: (patch: Partial<RelativePick>) => void,
    excludeId?: string,
  ) => {
    const localMatches =
      !picked.picked && picked.query.trim()
        ? searchPeople(people, picked.query)
            .filter((p) => p.id !== excludeId)
            .slice(0, 6)
        : [];
    return (
      <div className="onboarding-relative">
        <div className="onboarding-relative__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={picked.mode === "existing"}
            className={picked.mode === "existing" ? "is-active" : undefined}
            onClick={() => onChange({ mode: "existing" })}
          >
            Z drzewa
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={picked.mode === "new"}
            className={picked.mode === "new" ? "is-active" : undefined}
            onClick={() => onChange({ mode: "new", picked: null })}
          >
            Nowa osoba
          </button>
        </div>
        {picked.mode === "existing" ? (
          picked.picked ? (
            <p className="selected-chip">
              Wybrano: <strong>{displayName(picked.picked)}</strong>{" "}
              <button
                type="button"
                className="btn btn-secondary btn-mini"
                onClick={() => onChange({ picked: null, query: "" })}
              >
                Zmień
              </button>
            </p>
          ) : (
            <>
              <label className="field-block">
                {label}
                <input
                  value={picked.query}
                  onChange={(e) => onChange({ query: e.target.value })}
                  placeholder="Imię i nazwisko…"
                />
              </label>
              {localMatches.length > 0 && (
                <ul className="who-matches">
                  {localMatches.map((p) => (
                    <li key={p.id}>
                      <button type="button" onClick={() => onChange({ picked: p })}>
                        {displayName(p)}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        ) : (
          <div className="form-grid">
            <label>
              Imię *
              <input
                value={picked.newPerson.firstName}
                onChange={(e) =>
                  onChange({
                    newPerson: { ...picked.newPerson, firstName: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Nazwisko *
              <input
                value={picked.newPerson.lastName}
                onChange={(e) =>
                  onChange({
                    newPerson: { ...picked.newPerson, lastName: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Płeć
              <select
                value={picked.newPerson.gender}
                onChange={(e) =>
                  onChange({
                    newPerson: {
                      ...picked.newPerson,
                      gender: e.target.value as Gender,
                    },
                  })
                }
              >
                <option value="unknown">nieznana</option>
                <option value="female">kobieta</option>
                <option value="male">mężczyzna</option>
              </select>
            </label>
            <label>
              Data ur. (opcjonalnie)
              <input
                type="date"
                value={picked.newPerson.birthDate || ""}
                onChange={(e) =>
                  onChange({
                    newPerson: {
                      ...picked.newPerson,
                      birthDate: e.target.value || undefined,
                    },
                  })
                }
              />
            </label>
          </div>
        )}
      </div>
    );
  };

  const finishOnTree = async () => {
    if (!self) return;
    setBusy(true);
    setError(null);
    try {
      for (const edit of parentEdits) {
        const original = people.find((p) => p.id === edit.personId);
        if (!original) continue;
        const changed =
          edit.firstName.trim() !== original.firstName ||
          edit.lastName.trim() !== original.lastName ||
          (edit.maidenName.trim() || "") !== (original.maidenName || "") ||
          (edit.birthDate || "") !== (original.birthDate || "");
        if (!changed) continue;
        await submitChange({
          kind: "correction",
          reporterName: displayName(self),
          reporterPersonId: self.id,
          targetPersonId: original.id,
          targetPersonName: displayName(original),
          message: `Weryfikacja danych rodzica podczas rejestracji: ${edit.firstName} ${edit.lastName}${edit.maidenName ? ` (z d. ${edit.maidenName})` : ""}${edit.birthDate ? `, ur. ${edit.birthDate}` : ""}.`,
        });
      }

      if (missingParentName.trim() && parentEdits.length < 2) {
        const { firstName, lastName } = splitName(missingParentName);
        await submitChange({
          kind: "relatives",
          reporterName: displayName(self),
          reporterPersonId: self.id,
          targetPersonId: self.id,
          targetPersonName: displayName(self),
          message: "Brakujący rodzic zgłoszony podczas rejestracji.",
          relatives: [{ relation: "rodzic", firstName, lastName }],
        });
      }

      if (wantsSpouse) {
        const hasExisting = spouse.mode === "existing" && spouse.picked;
        const hasNew =
          spouse.mode === "new" &&
          spouse.newPerson.firstName.trim() &&
          spouse.newPerson.lastName.trim();
        if (hasExisting || hasNew) {
          if (isAdmin) {
            await postGraphMutation({
              op: "link_spouse",
              anchorPersonId: self.id,
              relatedPersonId: hasExisting ? spouse.picked!.id : undefined,
              newPerson: hasNew ? spouse.newPerson : undefined,
            });
          } else {
            const relative: RelativeDraft = hasExisting
              ? {
                  relation: "małżonek/partnerka",
                  firstName: spouse.picked!.firstName,
                  lastName: spouse.picked!.lastName,
                  notes: `Osoba już jest w drzewie (id: ${spouse.picked!.id}).`,
                }
              : {
                  relation: "małżonek/partnerka",
                  firstName: spouse.newPerson.firstName,
                  lastName: spouse.newPerson.lastName,
                  maidenName: spouse.newPerson.maidenName,
                  birthDate: spouse.newPerson.birthDate,
                };
            await submitChange({
              kind: "relatives",
              reporterName: displayName(self),
              reporterPersonId: self.id,
              targetPersonId: self.id,
              targetPersonName: displayName(self),
              message: "Małżonek/partner zgłoszony podczas rejestracji.",
              relatives: [relative],
            });
          }
        }
      }

      const validChildren = children.filter(
        (c) =>
          (c.mode === "existing" && c.picked) ||
          (c.mode === "new" &&
            c.newPerson.firstName.trim() &&
            c.newPerson.lastName.trim()),
      );
      if (validChildren.length) {
        if (isAdmin) {
          for (const c of validChildren) {
            await postGraphMutation({
              op: "add_child",
              anchorPersonId: self.id,
              relatedPersonId:
                c.mode === "existing" && c.picked ? c.picked.id : undefined,
              newPerson: c.mode === "new" ? c.newPerson : undefined,
            });
          }
        } else {
          await submitChange({
            kind: "relatives",
            reporterName: displayName(self),
            reporterPersonId: self.id,
            targetPersonId: self.id,
            targetPersonName: displayName(self),
            message: "Dzieci zgłoszone podczas rejestracji.",
            relatives: validChildren.map((c) =>
              c.mode === "existing" && c.picked
                ? {
                    relation: "dziecko",
                    firstName: c.picked.firstName,
                    lastName: c.picked.lastName,
                    notes: `Osoba już jest w drzewie (id: ${c.picked.id}).`,
                  }
                : {
                    relation: "dziecko",
                    firstName: c.newPerson.firstName,
                    lastName: c.newPerson.lastName,
                    maidenName: c.newPerson.maidenName,
                    birthDate: c.newPerson.birthDate,
                  },
            ),
          });
        }
      }

      setDoneMessage(
        isAdmin
          ? "Gotowe! Zmiany w drzewie zostały zapisane."
          : "Dzięki! Zapisaliśmy Twoje zgłoszenia — administrator je zatwierdzi.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finishOffTree = async () => {
    setBusy(true);
    setError(null);
    try {
      const relatives: RelativeDraft[] = [];
      if (parentName.trim()) {
        const found = parentMatch;
        const { firstName, lastName } = found
          ? { firstName: found.firstName, lastName: found.lastName }
          : splitName(parentName);
        relatives.push({
          relation: "rodzic",
          firstName,
          lastName,
          maidenName: found?.maidenName,
          birthDate: found?.birthDate,
          notes: found
            ? `Znaleziony w drzewie (id: ${found.id}).`
            : "Brak w drzewie — do sprawdzenia przez administratora.",
        });
      }
      if (grandparentName.trim()) {
        const found = grandparentMatch;
        const { firstName, lastName } = found
          ? { firstName: found.firstName, lastName: found.lastName }
          : splitName(grandparentName);
        relatives.push({
          relation: "dziadek/babcia",
          firstName,
          lastName,
          maidenName: found?.maidenName,
          birthDate: found?.birthDate,
          notes: found
            ? `Znaleziony w drzewie (id: ${found.id}).`
            : "Brak w drzewie — do sprawdzenia przez administratora.",
        });
      }

      const chain = [
        parentName.trim()
          ? `Rodzic „${parentName.trim()}”: ${parentMatch ? "znaleziony w drzewie" : "nie znaleziono w drzewie"}.`
          : null,
        grandparentName.trim()
          ? `Dziadek/babcia „${grandparentName.trim()}”: ${grandparentMatch ? "znaleziony w drzewie" : "nie znaleziono w drzewie"}.`
          : null,
        !parentName.trim() && !grandparentName.trim()
          ? "Nie udało się wskazać żadnej znanej gałęzi — całkowicie brak na drzewie."
          : null,
        extraNote.trim() || null,
      ]
        .filter(Boolean)
        .join(" ");

      const name = displayName(selfDraft);
      saveReporter({ name });

      await submitChange({
        kind: "missing_person",
        reporterName: name,
        message: chain || "Zgłoszenie brakującej osoby podczas rejestracji.",
        self: {
          firstName: selfDraft.firstName.trim(),
          lastName: selfDraft.lastName.trim(),
          maidenName: selfDraft.maidenName.trim() || undefined,
          birthDate: selfDraft.birthDate || undefined,
          gender: selfDraft.gender,
          phone: selfDraft.phone || undefined,
        },
        relatives,
      });

      setDoneMessage(
        "Dzięki! Zapisaliśmy Twoje zgłoszenie — administrator dopasuje gałąź i doda Cię do drzewa.",
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (doneMessage) {
    return (
      <main className="gate onboarding">
        <div className="gate-atmosphere" aria-hidden />
        <section className="gate-panel onboarding-panel">
          <p className="gate-brand">Drzewo Potrykus</p>
          <h1 className="onboarding-title">Dziękujemy!</h1>
          <p className="banner-success" role="status">
            {doneMessage}
          </p>
          <div className="modal-actions modal-actions--stack">
            <button type="button" className="btn btn-primary" onClick={onFinish}>
              Przejdź do drzewa
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="gate onboarding">
      <div className="gate-atmosphere" aria-hidden />
      <section className="gate-panel onboarding-panel">
        <p className="gate-brand">Drzewo Potrykus</p>

        {phase === "search" && (
          <>
            <StepHeader
              eyebrow="Krok 1 z 2"
              title="Kim jesteś w rodzinie?"
              lead="Znajdź siebie na drzewie — pokażemy od razu Twoich rodziców, małżonka i dzieci do uzupełnienia."
            />
            <label className="field-block" htmlFor="onb-search">
              Szukaj siebie w drzewie
              <input
                id="onb-search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Np. Adam Lieske…"
              />
            </label>
            {matches.length > 0 && (
              <ul className="who-matches">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="who-matches__pick"
                      onClick={() => pickSelf(p)}
                    >
                      <span>{displayName(p)}</span>
                      <span className="who-matches__go">To ja →</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && matches.length === 0 && (
              <p className="empty-hint">Brak wyników — sprawdź pisownię albo zgłoś się jako nowa osoba.</p>
            )}
            <div className="modal-actions modal-actions--stack">
              <button type="button" className="btn btn-secondary" onClick={goOffTree}>
                Nie widzę siebie na drzewie
              </button>
              <button type="button" className="btn btn-secondary btn-mini" onClick={skip}>
                Pomiń na razie
              </button>
            </div>
          </>
        )}

        {phase === "onTree" && self && (
          <>
            <StepHeader
              eyebrow="Krok 2 z 2"
              title={`Cześć, ${self.firstName}!`}
              lead="Zweryfikuj dane rodziców i dodaj małżonka oraz dzieci — reszta rodziny to doceni."
            />

            <fieldset className="onboarding-section">
              <legend>Rodzice</legend>
              {parentEdits.length === 0 && (
                <p className="empty-hint">
                  Brak rodziców na drzewie — jeśli znasz ich imiona, podaj poniżej.
                </p>
              )}
              {parentEdits.map((edit) => (
                <div key={edit.personId} className="form-grid onboarding-parent">
                  <label>
                    Imię
                    <input
                      value={edit.firstName}
                      onChange={(e) =>
                        updateParentEdit(edit.personId, { firstName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Nazwisko
                    <input
                      value={edit.lastName}
                      onChange={(e) =>
                        updateParentEdit(edit.personId, { lastName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Nazwisko rodowe
                    <input
                      value={edit.maidenName}
                      onChange={(e) =>
                        updateParentEdit(edit.personId, { maidenName: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Data urodzenia
                    <input
                      type="date"
                      value={edit.birthDate}
                      onChange={(e) =>
                        updateParentEdit(edit.personId, { birthDate: e.target.value })
                      }
                    />
                  </label>
                </div>
              ))}
              {parentEdits.length < 2 && (
                <label className="field-block">
                  {parentEdits.length === 0 ? "Rodzic (imię i nazwisko)" : "Drugi rodzic — brakuje na drzewie"}
                  <input
                    value={missingParentName}
                    onChange={(e) => setMissingParentName(e.target.value)}
                    placeholder="Np. Maria Potrykus"
                  />
                </label>
              )}
            </fieldset>

            <fieldset className="onboarding-section">
              <legend>Małżonek / partner</legend>
              {!wantsSpouse ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setWantsSpouse(true)}
                >
                  + Dodaj małżonka / partnera
                </button>
              ) : (
                <>
                  {relativePicker(
                    "Szukaj małżonka/partnera",
                    spouse,
                    (patch) => setSpouse((s) => ({ ...s, ...patch })),
                    self.id,
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-mini"
                    onClick={() => {
                      setWantsSpouse(false);
                      setSpouse(makeRelativePick());
                    }}
                  >
                    Usuń
                  </button>
                </>
              )}
            </fieldset>

            <fieldset className="onboarding-section">
              <legend>Dzieci</legend>
              {children.map((child) => (
                <div key={child.key} className="onboarding-child">
                  {relativePicker(
                    "Szukaj dziecka",
                    child,
                    (patch) => updateRelative(children, setChildren, child.key, patch),
                    self.id,
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-mini"
                    onClick={() =>
                      setChildren((rows) => rows.filter((r) => r.key !== child.key))
                    }
                  >
                    Usuń
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setChildren((rows) => [...rows, makeRelativePick()])}
              >
                + Dodaj dziecko
              </button>
            </fieldset>

            {error && (
              <p className="banner-error" role="alert">
                {error}
              </p>
            )}

            <div className="modal-actions modal-actions--stack">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={finishOnTree}
              >
                {busy ? "Zapisuję…" : "Zapisz i przejdź do drzewa"}
              </button>
              <button type="button" className="btn btn-secondary btn-mini" onClick={skip}>
                Pomiń na razie
              </button>
            </div>
          </>
        )}

        {phase === "offSelf" && (
          <>
            <StepHeader
              eyebrow="Krok 2 z 4"
              title="Twoje dane"
              lead="Nie ma Cię jeszcze na drzewie — podaj podstawowe dane, poszukamy Twoich rodziców."
            />
            <div className="form-grid">
              <label>
                Imię *
                <input
                  required
                  value={selfDraft.firstName}
                  onChange={(e) =>
                    setSelfDraft((d) => ({ ...d, firstName: e.target.value }))
                  }
                />
              </label>
              <label>
                Nazwisko *
                <input
                  required
                  value={selfDraft.lastName}
                  onChange={(e) =>
                    setSelfDraft((d) => ({ ...d, lastName: e.target.value }))
                  }
                />
              </label>
              <label>
                Nazwisko rodowe
                <input
                  value={selfDraft.maidenName}
                  onChange={(e) =>
                    setSelfDraft((d) => ({ ...d, maidenName: e.target.value }))
                  }
                />
              </label>
              <label>
                Data urodzenia
                <input
                  type="date"
                  value={selfDraft.birthDate}
                  onChange={(e) =>
                    setSelfDraft((d) => ({ ...d, birthDate: e.target.value }))
                  }
                />
              </label>
              <label>
                Płeć
                <select
                  value={selfDraft.gender}
                  onChange={(e) =>
                    setSelfDraft((d) => ({ ...d, gender: e.target.value as Gender }))
                  }
                >
                  <option value="unknown">—</option>
                  <option value="female">kobieta</option>
                  <option value="male">mężczyzna</option>
                </select>
              </label>
              <label>
                Telefon (opcjonalnie)
                <input
                  value={selfDraft.phone}
                  onChange={(e) => setSelfDraft((d) => ({ ...d, phone: e.target.value }))}
                />
              </label>
            </div>
            <div className="modal-actions modal-actions--stack">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selfDraft.firstName.trim() || !selfDraft.lastName.trim()}
                onClick={() => {
                  setError(null);
                  setPhase("offParent");
                }}
              >
                Dalej — szukaj rodzica
              </button>
              <button type="button" className="btn btn-secondary btn-mini" onClick={skip}>
                Pomiń na razie
              </button>
            </div>
          </>
        )}

        {phase === "offParent" && (
          <>
            <StepHeader
              eyebrow="Krok 3 z 4"
              title="Wpisz imię i nazwisko rodzica"
              lead="Sprawdzimy, czy jest już na drzewie."
            />
            {parentMatch ? (
              <p className="selected-chip">
                Znaleziono: <strong>{displayName(parentMatch)}</strong>{" "}
                <button
                  type="button"
                  className="btn btn-secondary btn-mini"
                  onClick={() => {
                    setParentMatch(null);
                    setParentName("");
                    setParentQuery("");
                  }}
                >
                  Zmień
                </button>
              </p>
            ) : (
              <label className="field-block">
                Rodzic (imię i nazwisko)
                <input
                  autoFocus
                  value={parentQuery}
                  onChange={(e) => {
                    setParentQuery(e.target.value);
                    setParentName(e.target.value);
                  }}
                  placeholder="Np. Jan Potrykus"
                />
              </label>
            )}
            {!parentMatch && parentMatches.length > 0 && (
              <ul className="who-matches">
                {parentMatches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setParentMatch(p);
                        setParentName(displayName(p));
                      }}
                    >
                      {displayName(p)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!parentMatch && parentQuery.trim() && parentMatches.length === 0 && (
              <p className="empty-hint">Brak dopasowania na drzewie — spróbujemy dziadka/babci.</p>
            )}
            <div className="modal-actions modal-actions--stack">
              {parentMatch ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setPhase("offReview")}
                >
                  Dalej — podsumowanie
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setPhase("offGrandparent")}
                >
                  {parentName.trim() ? "Dalej — szukaj dziadka/babci" : "Nie znam rodzica — dalej"}
                </button>
              )}
              <button type="button" className="btn btn-secondary btn-mini" onClick={skip}>
                Pomiń na razie
              </button>
            </div>
          </>
        )}

        {phase === "offGrandparent" && (
          <>
            <StepHeader
              eyebrow="Krok 4 z 4"
              title="Wpisz imię i nazwisko dziadka lub babci"
              lead="Rodzica nie znaleźliśmy na drzewie — spróbujmy przez dziadka/babcię."
            />
            {grandparentMatch ? (
              <p className="selected-chip">
                Znaleziono: <strong>{displayName(grandparentMatch)}</strong>{" "}
                <button
                  type="button"
                  className="btn btn-secondary btn-mini"
                  onClick={() => {
                    setGrandparentMatch(null);
                    setGrandparentName("");
                    setGrandparentQuery("");
                  }}
                >
                  Zmień
                </button>
              </p>
            ) : (
              <label className="field-block">
                Dziadek / babcia (imię i nazwisko)
                <input
                  autoFocus
                  value={grandparentQuery}
                  onChange={(e) => {
                    setGrandparentQuery(e.target.value);
                    setGrandparentName(e.target.value);
                  }}
                  placeholder="Np. Stanisław Potrykus"
                />
              </label>
            )}
            {!grandparentMatch && grandparentMatches.length > 0 && (
              <ul className="who-matches">
                {grandparentMatches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setGrandparentMatch(p);
                        setGrandparentName(displayName(p));
                      }}
                    >
                      {displayName(p)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!grandparentMatch &&
              grandparentQuery.trim() &&
              grandparentMatches.length === 0 && (
                <p className="empty-hint">
                  Też brak na drzewie — to znaczy, że cała gałąź jest nowa. Nic nie
                  szkodzi, admin ją doda.
                </p>
              )}
            <div className="modal-actions modal-actions--stack">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPhase("offReview")}
              >
                Dalej — podsumowanie
              </button>
              <button type="button" className="btn btn-secondary btn-mini" onClick={skip}>
                Pomiń na razie
              </button>
            </div>
          </>
        )}

        {phase === "offReview" && (
          <>
            <StepHeader
              eyebrow="Podsumowanie"
              title="Sprawdź i wyślij"
              lead="Administrator dopasuje Cię do właściwej gałęzi i doda do drzewa."
            />
            <ul className="onboarding-summary">
              <li>
                <span>Ty</span>
                <strong>{displayName(selfDraft) || "—"}</strong>
              </li>
              <li>
                <span>Rodzic</span>
                <strong>
                  {parentName.trim()
                    ? `${parentName} ${parentMatch ? "(w drzewie)" : "(brak w drzewie)"}`
                    : "nie podano"}
                </strong>
              </li>
              <li>
                <span>Dziadek/babcia</span>
                <strong>
                  {grandparentName.trim()
                    ? `${grandparentName} ${grandparentMatch ? "(w drzewie)" : "(brak w drzewie)"}`
                    : "nie podano"}
                </strong>
              </li>
            </ul>
            <label className="field-block">
              Dodatkowy opis (opcjonalnie)
              <textarea
                rows={3}
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="Cokolwiek, co pomoże nas rozpoznać w drzewie…"
              />
            </label>
            {error && (
              <p className="banner-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions modal-actions--stack">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={finishOffTree}
              >
                {busy ? "Wysyłam…" : "Wyślij zgłoszenie"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  setPhase(parentMatch ? "offParent" : "offGrandparent")
                }
              >
                Wstecz
              </button>
              <button type="button" className="btn btn-secondary btn-mini" onClick={skip}>
                Pomiń na razie
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
