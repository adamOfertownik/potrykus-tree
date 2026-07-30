"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLogout } from "@/lib/hooks";

export function AppShell({
  children,
  peopleCount,
}: {
  children: React.ReactNode;
  peopleCount?: number;
}) {
  const pathname = usePathname();
  const logout = useLogout();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <Link href="/drzewo" className="brand-link">
            Drzewo Potrykus
          </Link>
          {typeof peopleCount === "number" && (
            <span className="people-count">{peopleCount} osób</span>
          )}
        </div>
        <nav className="app-nav">
          <Link
            href="/drzewo"
            className={pathname.startsWith("/drzewo") ? "is-active" : ""}
          >
            Drzewo
          </Link>
          <Link
            href="/lista"
            className={pathname.startsWith("/lista") ? "is-active" : ""}
          >
            Lista
          </Link>
          <button
            type="button"
            className="nav-logout"
            onClick={() => logout.mutate()}
          >
            Wyloguj
          </button>
        </nav>
      </header>
      <div className="app-main">{children}</div>
      <footer className="app-footer">
        Twórca: Adam Lieske · dane lokalne · dostęp kodem rodzinnym
      </footer>
    </div>
  );
}
