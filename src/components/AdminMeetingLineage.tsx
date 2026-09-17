"use client";

import Link from "next/link";
import type { Person } from "@/types/family";
import {
  classifyPersonLineage,
  lineageLabel,
  MEETING_HELENA_ID,
  MEETING_LINE_ROOT_ID,
  MEETING_WLADEK_ID,
  summarizeMeetingLineage,
} from "@/lib/eventLineage";

type RsvpLike = {
  fullName: string;
  personId?: string;
  coveredPersonIds: string[];
  guests: number;
  status?: string;
};

function ticketWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "bilet";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "bilety";
  return "biletów";
}

function Count({ people, tickets }: { people: number; tickets: number }) {
  if (tickets === people || tickets === 0) {
    return <strong>{people}</strong>;
  }
  return (
    <strong>
      {people} os. · {tickets} {ticketWord(tickets)}
    </strong>
  );
}

function Names({ names }: { names: string[] }) {
  if (!names.length) return null;
  return (
    <details className="admin-lineage__names">
      <summary>Kto ({names.length})</summary>
      <p>{names.join(", ")}</p>
    </details>
  );
}

export function AdminMeetingLineage({
  people,
  rsvps,
}: {
  people: Person[];
  rsvps: RsvpLike[];
}) {
  const summary = summarizeMeetingLineage(people, rsvps);

  return (
    <section className="admin-pay__lineage" aria-labelledby="admin-lineage-title">
      <h2 id="admin-lineage-title">Kto od kogo na spotkanie</h2>
      <p className="empty-hint">
        Spotkanie jest głównie z linii{" "}
        <Link href={`/osoba/${MEETING_LINE_ROOT_ID}`}>{summary.rootName}</Link>.
        Liczymy zapisane osoby według jego dzieci — ile od Babci Heleny, ile od
        Władka, ile od pozostałych.
      </p>
      <p className="admin-lineage__total">
        Z drzewa: {summary.treePersonCount} osób
        {summary.ticketTotal
          ? ` · ${summary.ticketTotal} biletów łącznie`
          : ""}
        .
      </p>
      <div className="admin-lineage__highlights">
        <article className="admin-lineage__card is-helena">
          <h3>
            <Link href={`/osoba/${MEETING_HELENA_ID}`}>Babcia Helena</Link>
          </h3>
          <p className="empty-hint">Helena Hallmann, córka Franciszka</p>
          <p>
            <Count
              people={summary.helena?.personCount ?? 0}
              tickets={summary.helena?.ticketCount ?? 0}
            />
          </p>
          <Names names={summary.helena?.names ?? []} />
        </article>
        <article className="admin-lineage__card is-wladek">
          <h3>
            <Link href={`/osoba/${MEETING_WLADEK_ID}`}>Władek</Link>
          </h3>
          <p className="empty-hint">Władysław Potrykus, syn Franciszka</p>
          <p>
            <Count
              people={summary.wladek?.personCount ?? 0}
              tickets={summary.wladek?.ticketCount ?? 0}
            />
          </p>
          <Names names={summary.wladek?.names ?? []} />
        </article>
      </div>
      <h3 className="admin-lineage__sub">Od kogo — dzieci Franciszka</h3>
      <ul className="admin-lineage__branches">
        {summary.branches.map((row) => (
          <li
            key={row.id}
            className={
              row.highlight === "helena"
                ? "is-helena"
                : row.highlight === "wladek"
                  ? "is-wladek"
                  : undefined
            }
          >
            <div>
              <Link href={`/osoba/${row.id}`}>{row.name}</Link>
              {row.highlight === "helena" ? (
                <span className="admin-lineage__tag">Babcia Helena</span>
              ) : null}
              {row.highlight === "wladek" ? (
                <span className="admin-lineage__tag">Władek</span>
              ) : null}
            </div>
            <Count people={row.personCount} tickets={row.ticketCount} />
            <Names names={row.names} />
          </li>
        ))}
      </ul>
      {summary.rootCount > 0 ? (
        <p className="empty-hint">
          Sami Franciszek / Helena Gurska (albo współmałżonek): {summary.rootCount}.
        </p>
      ) : null}
      {summary.outsideCount > 0 || summary.outsideTicketCount > 0 ? (
        <div className="admin-lineage__other">
          <p>
            Poza linią Franciszka:{" "}
            <Count
              people={summary.outsideCount}
              tickets={summary.outsideTicketCount}
            />
          </p>
          <Names names={summary.outsideNames} />
        </div>
      ) : null}
      {summary.unmatchedTicketCount > 0 || summary.unmatchedNameCount > 0 ? (
        <p className="empty-hint">
          Bez osoby w drzewie: {summary.unmatchedNameCount} zgłoszeń,{" "}
          {summary.unmatchedTicketCount} biletów.
        </p>
      ) : null}
    </section>
  );
}

export function rsvpLineageHint(
  rsvp: { personId?: string; coveredPersonIds: string[]; fullName: string },
  people: Person[],
): string | null {
  const ids = [
    ...new Set(
      [rsvp.personId, ...(rsvp.coveredPersonIds ?? [])].filter(Boolean),
    ),
  ] as string[];
  if (!ids.length) return null;
  const labels = [
    ...new Set(
      ids.map((id) =>
        lineageLabel(classifyPersonLineage(id, people), people),
      ),
    ),
  ];
  if (!labels.length) return null;
  return labels.join(" · ");
}
