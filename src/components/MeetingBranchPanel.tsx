"use client";

import Link from "next/link";
import {
  groupAttendingByMeetingBranch,
  MEETING_TREE_HREF,
  namedPeopleOnBranch,
  plPeople,
  type MeetingBranch,
} from "@/lib/meetingBranches";
import type { Person } from "@/types/family";

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
  const branches = groupAttendingByMeetingBranch(people, attendingPersonIds);
  const total = attendingPersonIds.filter((id) =>
    people.some((p) => p.id === id),
  ).length;

  if (variant === "bar") {
    return (
      <div className="meeting-branch-bar" data-testid="meeting-branch-bar">
        <p className="meeting-branch-bar__lead">
          Na spotkaniu {plPeople(total)} od Franciszka
        </p>
        <ul className="meeting-branch-chips">
          {branches
            .filter((branch) => branch.featured || branch.personIds.length > 0)
            .map((branch) => (
              <li key={branch.key}>
                <span>{branch.short}</span>
                <strong>{branch.personIds.length}</strong>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <section
      className="event-section meeting-from-root"
      data-testid="meeting-from-franciszek"
    >
      <h2>Główne spotkanie od Franciszka</h2>
      <p className="event-section__lead">
        Liczymy zapisy od Franciszka Potrykusa — ile osób idzie od babci Heleny,
        od dziadka Władka i od której babci albo dziadka jest kto.
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

      <ul className="meeting-branch-counts">
        {branches.map((branch) => (
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

      <div className="meeting-branch-people">
        {branches
          .filter((branch) => branch.personIds.length > 0)
          .map((branch) => (
            <BranchPeople key={branch.key} branch={branch} people={people} />
          ))}
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
