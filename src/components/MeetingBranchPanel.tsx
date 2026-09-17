"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  groupAttendingByMeetingBranch,
  groupFamilyByMeetingBranch,
  MEETING_TREE_HREF,
  namedPeopleOnBranch,
  plPeople,
  type MeetingBranch,
} from "@/lib/meetingBranches";
import type { Person } from "@/types/family";

const WHO_STORAGE_KEY = "potrykus_meeting_who_v1";
const whoListeners = new Set<() => void>();

function readWhoVisible(): boolean {
  try {
    return localStorage.getItem(WHO_STORAGE_KEY) !== "hidden";
  } catch {
    return true;
  }
}

function subscribeWhoVisible(onStoreChange: () => void) {
  whoListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === WHO_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    whoListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeWhoVisible(visible: boolean) {
  try {
    localStorage.setItem(WHO_STORAGE_KEY, visible ? "shown" : "hidden");
  } catch {
    /* ignore */
  }
  whoListeners.forEach((listener) => listener());
}

function useMeetingWhoVisible() {
  const visible = useSyncExternalStore(
    subscribeWhoVisible,
    readWhoVisible,
    () => true,
  );
  const setWhoVisible = useCallback((next: boolean) => {
    writeWhoVisible(next);
  }, []);
  return [visible, setWhoVisible] as const;
}

export function MeetingBranchPanel({
  people,
  attendingPersonIds,
  variant = "page",
  showButton = false,
}: {
  people: Person[];
  attendingPersonIds: string[];
  variant?: "page" | "bar";
  showButton?: boolean;
}) {
  const family = groupFamilyByMeetingBranch(people);
  const going = groupAttendingByMeetingBranch(people, attendingPersonIds);
  const totalGoing = attendingPersonIds.filter((id) =>
    people.some((p) => p.id === id),
  ).length;
  const [whoVisible, setWhoVisible] = useMeetingWhoVisible();

  if (variant === "bar") {
    return (
      <div
        className={`meeting-branch-bar${whoVisible ? "" : " is-collapsed"}`}
        data-testid="meeting-branch-bar"
        data-who-visible={whoVisible ? "true" : "false"}
      >
        <div className="meeting-branch-bar__head">
          <p className="meeting-branch-bar__lead">
            {whoVisible
              ? `Na spotkaniu ${plPeople(totalGoing)} od Franciszka`
              : "Kto będzie na spotkaniu"}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-mini"
            data-testid="meeting-who-toggle"
            aria-expanded={whoVisible}
            onClick={() => setWhoVisible(!whoVisible)}
          >
            {whoVisible ? "Ukryj" : "Pokaż"}
          </button>
        </div>
        {whoVisible ? (
          <ul className="meeting-branch-chips">
            {going
              .filter((branch) => branch.featured || branch.personIds.length > 0)
              .map((branch) => (
                <li key={branch.key}>
                  <span>{branch.short}</span>
                  <strong>{branch.personIds.length}</strong>
                </li>
              ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const goingNamed = going.filter((branch) => branch.personIds.length > 0);

  return (
    <section
      className="event-section meeting-from-root"
      data-testid="meeting-from-franciszek"
    >
      <h2>Główne spotkanie od Franciszka</h2>
      <p className="event-section__lead">
        Rodzinę i zapisy grupujemy od babci albo dziadka — bez listy stu
        pięćdziesięciu imion.
      </p>
      {showButton ? (
        <Link
          href={MEETING_TREE_HREF}
          className="btn btn-primary meeting-franciszek-btn"
          data-testid="spotkanie-od-franciszka"
        >
          Spotkanie od Franciszka
        </Link>
      ) : null}

      <h3 className="meeting-subhead">Rodzina od Franciszka</h3>
      <p className="event-section__lead">
        Ile osób jest w której gałęzi. Imion tu nie wypisujemy.
      </p>
      <ul className="meeting-branch-counts" data-testid="meeting-family-groups">
        {family.map((branch) => (
          <li
            key={branch.key}
            className={branch.featured ? "is-featured" : undefined}
            data-testid="meeting-branch-count"
            data-branch={branch.short}
          >
            <span>{branch.label}</span>
            <strong>{plPeople(branch.personIds.length)}</strong>
          </li>
        ))}
      </ul>

      <div
        className="meeting-who-block"
        data-testid="meeting-who-block"
        data-who-visible={whoVisible ? "true" : "false"}
      >
        <div className="meeting-who-block__head">
          <h3 className="meeting-subhead">Kto będzie — od kogo</h3>
          <button
            type="button"
            className="btn btn-secondary btn-mini"
            data-testid="meeting-who-toggle"
            aria-expanded={whoVisible}
            onClick={() => setWhoVisible(!whoVisible)}
          >
            {whoVisible ? "Ukryj" : "Pokaż"}
          </button>
        </div>
        {whoVisible ? (
          goingNamed.length === 0 ? (
            <p className="empty-hint">Nikt z drzewa nie jest jeszcze zapisany.</p>
          ) : (
            <div
              className="meeting-branch-people"
              data-testid="meeting-going-groups"
            >
              {goingNamed.map((branch) => (
                <BranchPeople key={branch.key} branch={branch} people={people} />
              ))}
            </div>
          )
        ) : (
          <p className="event-section__lead">
            Lista imion jest ukryta. Możesz ją z powrotem pokazać w każdej chwili.
          </p>
        )}
      </div>
    </section>
  );
}

function BranchPeople({
  branch,
  people,
}: {
  branch: MeetingBranch;
  people: Person[];
}) {
  const named = namedPeopleOnBranch(people, branch.personIds);
  return (
    <div className="meeting-branch-group">
      <h3>
        {branch.label}{" "}
        <span>({plPeople(named.length)})</span>
      </h3>
      <ul>
        {named.map((person) => (
          <li key={person.id}>
            <Link href={`/osoba/${encodeURIComponent(person.id)}`}>
              {person.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
