"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { PersonSearch } from "@/components/PersonSearch";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { describeKinship } from "@/lib/kinship";
import { displayName } from "@/lib/db-client";
import type { Person } from "@/types/family";
import { useIdentity } from "@/components/IdentityProvider";

function PickSlot({
  label,
  people,
  selected,
  onSelect,
  onClear,
  meAction,
}: {
  label: string;
  people: Person[];
  selected: Person | null;
  onSelect: (p: Person) => void;
  onClear: () => void;
  meAction?: { name: string; onPick: () => void };
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
          <a
            href={`/osoba/${encodeURIComponent(selected.id)}`}
            className="btn-text"
            onClick={(e) => {
              e.preventDefault();
              window.location.assign(
                `/osoba/${encodeURIComponent(selected.id)}`,
              );
            }}
          >
            Profil
          </a>
        </div>
      ) : (
        <>
          <PersonSearch
            people={people}
            placeholder="Wybierz osobę…"
            onSelect={onSelect}
          />
          {meAction && (
            <button
              type="button"
              className="btn-text kinship-pick__me"
              onClick={meAction.onPick}
            >
              Wstaw mnie ({meAction.name})
            </button>
          )}
        </>
      )}
    </div>
  );
}

function KinshipInner({ people }: { people: Person[] }) {
  const { identity } = useIdentity();
  const [personA, setPersonA] = useState<Person | null>(null);
  const [personB, setPersonB] = useState<Person | null>(null);
  const [prefilled, setPrefilled] = useState(false);

  const me = useMemo(
    () =>
      identity?.personId
        ? people.find((p) => p.id === identity.personId) ?? null
        : null,
    [people, identity?.personId],
  );

  useEffect(() => {
    if (prefilled || !me) return;
    setPersonA(me);
    setPrefilled(true);
  }, [me, prefilled]);

  const result = useMemo(() => {
    if (!personA || !personB) return null;
    return describeKinship(people, personA.id, personB.id);
  }, [people, personA, personB]);

  const swap = () => {
    setPersonA(personB);
    setPersonB(personA);
  };

  return (
    <section className="kinship-page">
      <header className="kinship-page__intro">
        <h1>Kto jest kim</h1>
        <p>
          Wybierz dwie osoby z rodziny — pokażemy, kim są dla siebie.
          {identity?.name ? ` Jesteś zapisany/a jako ${identity.name}.` : ""}
        </p>
      </header>

      <div className="kinship-picks">
        <PickSlot
          label={me && personA?.id === me.id ? "Ty (A)" : "Osoba A"}
          people={people}
          selected={personA}
          onSelect={setPersonA}
          onClear={() => setPersonA(null)}
          meAction={
            me && personB?.id !== me.id
              ? { name: displayName(me), onPick: () => setPersonA(me) }
              : undefined
          }
        />
        <PickSlot
          label="Osoba B"
          people={people}
          selected={personB}
          onSelect={setPersonB}
          onClear={() => setPersonB(null)}
          meAction={
            me && personA?.id !== me.id
              ? { name: displayName(me), onPick: () => setPersonB(me) }
              : undefined
          }
        />
      </div>

      {(personA || personB) && (
        <div className="kinship-toolbar">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={swap}
            disabled={!personA || !personB}
          >
            ⇄ Zamień A i B
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPersonA(null);
              setPersonB(null);
            }}
          >
            Wyczyść
          </button>
        </div>
      )}

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
              <span className="kinship-result__dir">Ścieżka pokrewieństwa</span>
              <ol>
                {result.path.map((name, i) => (
                  <li key={`${name}-${i}`}>{name}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="kinship-result__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                window.location.assign(
                  `/drzewo?root=${encodeURIComponent(personA.id)}`,
                )
              }
            >
              Drzewo od A
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                window.location.assign(
                  `/drzewo?root=${encodeURIComponent(personB.id)}`,
                )
              }
            >
              Drzewo od B
            </button>
          </div>
        </div>
      )}

      {!result && (
        <p className="empty-hint">
          Wybierz obie osoby, żeby zobaczyć pokrewieństwo.
        </p>
      )}
    </section>
  );
}

export function KinshipPageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const people = family.data?.people ?? [];

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
      <KinshipInner people={people} />
    </AppShell>
  );
}
