"use client";

import Link from "next/link";
import { AuthedPage } from "@/components/AuthedPage";
import {
  birthdaysThisMonth,
  MONTH_NAMES_PL,
  upcomingBirthdays,
} from "@/lib/birthdays";
import { displayName } from "@/lib/db-client";

function BirthdaysInner({
  people,
}: {
  people: Parameters<typeof upcomingBirthdays>[0];
}) {
  const now = new Date();
  const month = birthdaysThisMonth(people, now);
  const upcoming = upcomingBirthdays(people, 45, now);

  return (
    <section className="birthdays-page">
      <header className="birthdays-page__intro">
        <h1>Urodziny i rocznice</h1>
        <p>
          W {MONTH_NAMES_PL[now.getMonth() + 1]} świętuje {month.length}{" "}
          {month.length === 1 ? "osoba" : "osób"} z żyjących w drzewie.
        </p>
      </header>

      <div className="birthdays-section">
        <h2>W tym miesiącu</h2>
        {month.length === 0 ? (
          <p className="empty-hint">Brak urodzin w tym miesiącu.</p>
        ) : (
          <ul className="birthdays-list">
            {month.map((e) => (
              <li key={e.person.id}>
                <span className="birthdays-list__when">
                  {e.day} {MONTH_NAMES_PL[e.month]}
                </span>
                <Link href={`/osoba/${e.person.id}`}>
                  {displayName(e.person)}
                </Link>
                {e.turningAge != null && (
                  <span className="birthdays-list__age">
                    kończy {e.turningAge} lat
                  </span>
                )}
                <Link
                  className="btn-text"
                  href={`/drzewo?root=${encodeURIComponent(e.person.id)}`}
                >
                  drzewo
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="birthdays-section">
        <h2>Najbliższe 45 dni</h2>
        <ul className="birthdays-list">
          {upcoming.map((e) => (
            <li key={`u-${e.person.id}`}>
              <span className="birthdays-list__when">
                {e.daysUntil === 0
                  ? "dziś"
                  : e.daysUntil === 1
                    ? "jutro"
                    : `za ${e.daysUntil} dni`}
              </span>
              <Link href={`/osoba/${e.person.id}`}>
                {displayName(e.person)}
              </Link>
              {e.turningAge != null && (
                <span className="birthdays-list__age">
                  {e.turningAge} lat
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function BirthdaysPageClient() {
  return (
    <AuthedPage>
      {({ people }) => <BirthdaysInner people={people} />}
    </AuthedPage>
  );
}
