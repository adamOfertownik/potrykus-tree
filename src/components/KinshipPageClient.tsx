"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { PersonSearch } from "@/components/PersonSearch";
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
          <Link
            href={`/osoba/${encodeURIComponent(selected.id)}`}
            className="btn-text"
          >
            Profil
          </Link>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const myId = identity?.personId ?? null;
  const me = useMemo(
    () => (myId ? people.find((p) => p.id === myId) ?? null : null),
    [people, myId],
  );

  const initialA =
    people.find((p) => p.id === searchParams.get("a")) ?? undefined;
  const initialB =
    people.find((p) => p.id === searchParams.get("b")) ?? null;

  const [pickA, setPickA] = useState<Person | null | undefined>(
    initialA ?? undefined,
  );
  const [personB, setPersonB] = useState<Person | null>(initialB);
  const personA = pickA === undefined ? me : pickA;

  const result = useMemo(() => {
    if (!personA || !personB) return null;
    return describeKinship(people, personA.id, personB.id);
  }, [people, personA, personB]);

  const setPersonA = (person: Person | null) => setPickA(person);

  const swap = () => {
    setPickA(personB);
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
                router.push(
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
                router.push(
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
  return (
    <AuthedPage>
      {({ people }) => <KinshipInner people={people} />}
    </AuthedPage>
  );
}
