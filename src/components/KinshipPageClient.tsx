"use client";

import { useMemo, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { PersonSearch } from "@/components/PersonSearch";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { describeKinship } from "@/lib/kinship";
import { displayName } from "@/lib/db-client";
import type { Person } from "@/types/family";
import Link from "next/link";

function PickSlot({
  label,
  people,
  selected,
  onSelect,
  onClear,
}: {
  label: string;
  people: Person[];
  selected: Person | null;
  onSelect: (p: Person) => void;
  onClear: () => void;
}) {
  return (
    <div className="kinship-pick">
      <div className="kinship-pick__head">
        <h2>{label}</h2>
        {selected && (
          <button type="button" className="btn-text" onClick={onClear}>
            Zmień
          </button>
        )}
      </div>
      {selected ? (
        <div className="kinship-pick__chosen">
          <strong>{displayName(selected)}</strong>
          <Link
            href={`/osoba/${encodeURIComponent(selected.id)}`}
            className="btn-text"
          >
            Profil
          </Link>
        </div>
      ) : (
        <PersonSearch
          people={people}
          placeholder="Wybierz osobę…"
          requireIdentity={false}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

export function KinshipPageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const [personA, setPersonA] = useState<Person | null>(null);
  const [personB, setPersonB] = useState<Person | null>(null);

  const people = family.data?.people ?? [];

  const result = useMemo(() => {
    if (!personA || !personB) return null;
    return describeKinship(people, personA.id, personB.id);
  }, [people, personA, personB]);

  if (auth.isLoading) {
    return <div className="loading-screen">Ładowanie…</div>;
  }
  if (!auth.data?.unlocked) {
    return <AccessGate />;
  }
  if (family.isLoading) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie…</div>
      </AppShell>
    );
  }
  if (family.isError || !family.data) {
    return (
      <AppShell>
        <div className="loading-screen">Nie udało się wczytać danych.</div>
      </AppShell>
    );
  }

  return (
    <AppShell peopleCount={people.length}>
      <section className="kinship-page">
        <header className="kinship-page__intro">
          <h1>Kto jest kim</h1>
          <p>
            Wybierz dwie osoby z rodziny — pokażemy, kim są dla siebie (np. mama
            i ciocia, kuzynostwo, teściowie).
          </p>
        </header>

        <div className="kinship-picks">
          <PickSlot
            label="Osoba A"
            people={people}
            selected={personA}
            onSelect={setPersonA}
            onClear={() => setPersonA(null)}
          />
          <PickSlot
            label="Osoba B"
            people={people}
            selected={personB}
            onSelect={setPersonB}
            onClear={() => setPersonB(null)}
          />
        </div>

        {result && personA && personB && (
          <div
            className={`kinship-result kinship-result--${result.kind}`}
            role="status"
          >
            <p className="kinship-result__pair">
              <strong>{displayName(personA)}</strong>
              <span aria-hidden> ↔ </span>
              <strong>{displayName(personB)}</strong>
            </p>

            <div className="kinship-result__labels">
              <div>
                <span className="kinship-result__dir">A dla B</span>
                <p>
                  <strong>{displayName(personA)}</strong> to{" "}
                  <em>{result.labelAtoB}</em> dla{" "}
                  <strong>{displayName(personB)}</strong>
                </p>
              </div>
              <div>
                <span className="kinship-result__dir">B dla A</span>
                <p>
                  <strong>{displayName(personB)}</strong> to{" "}
                  <em>{result.labelBtoA}</em> dla{" "}
                  <strong>{displayName(personA)}</strong>
                </p>
              </div>
            </div>

            <p className="kinship-result__summary">{result.summary}</p>

            {result.path.length > 1 && (
              <div className="kinship-result__path">
                <span className="kinship-result__dir">Ścieżka</span>
                <ol>
                  {result.path.map((name, i) => (
                    <li key={`${name}-${i}`}>{name}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="kinship-result__actions">
              <Link
                className="btn btn-secondary"
                href={`/drzewo?root=${encodeURIComponent(personA.id)}`}
              >
                Drzewo od A
              </Link>
              <Link
                className="btn btn-secondary"
                href={`/drzewo?root=${encodeURIComponent(personB.id)}`}
              >
                Drzewo od B
              </Link>
            </div>
          </div>
        )}

        {!result && (
          <p className="empty-hint">
            Wybierz obie osoby, żeby zobaczyć pokrewieństwo.
          </p>
        )}
      </section>
    </AppShell>
  );
}
