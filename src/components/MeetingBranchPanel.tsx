"use client";

import Link from "next/link";
import {
  groupAttendingByMeetingBranch,
  groupFamilyByMeetingBranch,
  namedPeopleOnBranch,
  plPeople,
  type MeetingBranch,
} from "@/lib/meetingBranches";
import type { Person } from "@/types/family";

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

/** Na drzewie Franciszka — krótkie chipy kto idzie. */
export function MeetingBranchPanel({
  people,
  attendingPersonIds,
  variant = "going",
}: {
  people: Person[];
  attendingPersonIds: string[];
  variant?: "going" | "bar";
}) {
  const going = groupAttendingByMeetingBranch(people, attendingPersonIds);
  const family = groupFamilyByMeetingBranch(people);
  const treeByKey = new Map(family.map((row) => [row.key, row.personIds.length]));
  const totalGoing = attendingPersonIds.filter((id) =>
    people.some((p) => p.id === id),
  ).length;
  const ratio = (branch: MeetingBranch) =>
    `${branch.personIds.length} / ${treeByKey.get(branch.key) ?? branch.personIds.length}`;

  if (variant === "bar") {
    return (
      <div className="meeting-branch-bar" data-testid="meeting-branch-bar">
        <p className="meeting-branch-bar__lead">
          Na spotkaniu {plPeople(totalGoing)} od Franciszka
          <span className="meeting-branch-bar__hint"> · zapisani / w drzewie</span>
        </p>
        <ul className="meeting-branch-chips">
          {going
            .filter((branch) => branch.kind === "branch")
            .map((branch) => (
              <li
                key={branch.key}
                className={branch.featured ? "is-featured" : undefined}
              >
                <span>{branch.short}</span>
                <strong>{ratio(branch)}</strong>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  const goingNamed = going.filter((branch) => branch.personIds.length > 0);
  const goingCounts = going.filter((branch) => branch.kind === "branch");

  return (
    <section
      className="event-section meeting-from-root"
      data-testid="meeting-from-franciszek"
    >
      <h2>Zapisy od kogo</h2>
      <p className="event-section__lead">
        Zapisani z drzewa / ile osób jest w tej gałęzi Franciszka. Pełne
        statystyki rodu są na stronie{" "}
        <Link href="/statystyki">Statystyki rodzin</Link>.
      </p>
      <ul className="meeting-branch-counts" data-testid="meeting-going-counts">
        {goingCounts.map((branch) => (
          <li
            key={branch.key}
            className={branch.featured ? "is-featured" : undefined}
            data-testid="meeting-going-count"
            data-branch={branch.short}
          >
            <span>{branch.label}</span>
            <strong>{ratio(branch)}</strong>
          </li>
        ))}
      </ul>
      {goingNamed.length === 0 ? (
        <p className="empty-hint">Nikt z drzewa nie jest jeszcze zapisany.</p>
      ) : (
        <div className="meeting-branch-people" data-testid="meeting-going-groups">
          {goingNamed.map((branch) => (
            <BranchPeople key={branch.key} branch={branch} people={people} />
          ))}
        </div>
      )}
    </section>
  );
}
