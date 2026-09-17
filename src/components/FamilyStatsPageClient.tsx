"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AuthedPage } from "@/components/AuthedPage";
import { buildFamilyInsights } from "@/lib/familyInsights";
import { MEETING_TREE_HREF, plPeople } from "@/lib/meetingBranches";
import type { Person } from "@/types/family";

export function FamilyStatsPageClient() {
  return (
    <AuthedPage loadingLabel="Wczytywanie statystyk…">
      {({ people, family }) => (
        <FamilyStatsBody
          people={people}
          attendingPersonIds={family.attendingPersonIds ?? []}
        />
      )}
    </AuthedPage>
  );
}

function FamilyStatsBody({
  people,
  attendingPersonIds,
}: {
  people: Person[];
  attendingPersonIds: string[];
}) {
  const stats = useMemo(
    () => buildFamilyInsights(people, attendingPersonIds),
    [people, attendingPersonIds],
  );

  return (
    <article className="event-page stats-page" data-testid="family-stats">
      <header className="event-hero">
        <p className="event-hero__eyebrow">Ród Potrykus</p>
        <h1>Statystyki rodzin</h1>
        <p className="event-hero__lead">
          Zależności z drzewa: od kogo idą gałęzie Franciszka, które imiona
          wracają, kto ma najwięcej dzieci i gdzie linie pobrały się ze sobą.
          To nie spis urzędowy — liczby z tego, co rodzina wpisała.
        </p>
        <Link
          href={MEETING_TREE_HREF}
          className="btn btn-primary meeting-franciszek-btn meeting-franciszek-btn--compact"
          data-testid="spotkanie-od-franciszka"
        >
          Drzewo od Franciszka
        </Link>
      </header>

      <section className="event-section">
        <h2>W skrócie</h2>
        <ul className="stats-kpis">
          <li>
            <span>W drzewie</span>
            <strong>{plPeople(stats.total)}</strong>
          </li>
          <li>
            <span>Linia Franciszka</span>
            <strong>{plPeople(stats.inFranciszekLine)}</strong>
          </li>
          <li>
            <span>Bez daty śmierci</span>
            <strong>{plPeople(stats.living)}</strong>
          </li>
          <li>
            <span>Ze zdjęciem</span>
            <strong>{stats.withPhoto}</strong>
          </li>
          <li>
            <span>Z telefonem</span>
            <strong>{stats.withPhone}</strong>
          </li>
          <li>
            <span>Małżeństwa / pary</span>
            <strong>{stats.couples}</strong>
          </li>
        </ul>
      </section>

      <section className="event-section">
        <h2>Gałęzie od dzieci Franciszka</h2>
        <p className="event-section__lead">
          Ile osób z drzewa zapisało się na spotkanie, na ile osób jest w
          tej gałęzi. Helena i Władek są wyróżnieni.
        </p>
        <ul className="meeting-branch-counts" data-testid="meeting-family-groups">
          {stats.livingByBranch.map((branch) => (
            <li
              key={branch.key}
              className={branch.featured ? "is-featured" : undefined}
              data-testid="meeting-branch-count"
            >
              <span>{branch.label}</span>
              <strong>
                {branch.going} / {branch.total}
              </strong>
              <em>zapisani / w drzewie</em>
            </li>
          ))}
        </ul>
      </section>

      {stats.crossMarriages.length > 0 ? (
        <section className="event-section">
          <h2>Gdzie linie się spotkały</h2>
          <p className="event-section__lead">
            Pary, w których mąż i żona siedzą w dwóch różnych odnogach
            Franciszka — kuzynostwo, które się pobrało.
          </p>
          <ul className="stats-list">
            {stats.crossMarriages.map((row) => (
              <li key={`${row.a}-${row.b}`}>
                <span>
                  {row.a} × {row.b}
                </span>
                <strong>
                  {row.count} {row.count === 1 ? "para" : "pary"}
                </strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="event-section">
        <h2>Imiona, które wracają</h2>
        <p className="event-section__lead">
          Najczęstsze imiona i nazwiska w całym drzewie — widać, kogo
          nazywamy po kim.
        </p>
        <div className="stats-two">
          <div>
            <h3 className="meeting-subhead">Imiona</h3>
            <ol className="stats-rank">
              {stats.topFirstNames.map((row) => (
                <li key={row.name}>
                  <span>{row.name}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="meeting-subhead">Nazwiska</h3>
            <ol className="stats-rank">
              {stats.topLastNames.map((row) => (
                <li key={row.name}>
                  <span>{row.name}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="event-section">
        <h2>Najwięcej dzieci</h2>
        <p className="event-section__lead">
          Osoby, pod którymi w drzewie wisi najwięcej dzieci (nie wnuków).
        </p>
        <ul className="stats-people">
          {stats.mostChildren.map((row) => (
            <li key={row.id}>
              <Link href={`/osoba/${row.id}`}>{row.name}</Link>
              <span>{row.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="stats-two">
        <section className="event-section">
          <h2>Najstarsi bez daty śmierci</h2>
          <p className="event-section__lead">
            Szacunek z roku urodzenia. Brak daty śmierci nie znaczy, że osoba
            na pewno żyje.
          </p>
          <ul className="stats-people">
            {stats.oldestLiving.map((row) => (
              <li key={row.id}>
                <Link href={`/osoba/${row.id}`}>{row.name}</Link>
                <span>{row.detail}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="event-section">
          <h2>Najdłuższe życie</h2>
          <p className="event-section__lead">
            Osoby z datą urodzenia i śmierci — ile lat wyszło z papierów.
          </p>
          <ul className="stats-people">
            {stats.longestLived.map((row) => (
              <li key={row.id}>
                <Link href={`/osoba/${row.id}`}>{row.name}</Link>
                <span>{row.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}
