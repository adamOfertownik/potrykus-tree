"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFamily, useLogout, useAdminAuthStatus, useAdminLogout } from "@/lib/hooks";
import { exportListPdf, exportTreeA0Pdf } from "@/lib/pdf";
import { PrototypeBanner } from "@/components/PrototypeBanner";
import { useTextScale, type TextScaleId } from "@/components/TextScaleProvider";
import { IdentityProvider, useIdentity } from "@/components/IdentityProvider";
import type { Person } from "@/types/family";

function AppShellInner({
  children,
  people,
  peopleCount,
  exportRootId,
  metaTitle,
  metaRootId,
}: {
  children: React.ReactNode;
  people: Person[];
  peopleCount?: number;
  exportRootId?: string;
  metaTitle?: string;
  metaRootId?: string;
}) {
  const pathname = usePathname();
  const logout = useLogout();
  const adminAuth = useAdminAuthStatus();
  const adminLogout = useAdminLogout();
  const isAdmin = Boolean(adminAuth.data?.loggedIn);
  const { scale, setScale } = useTextScale();
  const { identity, promptIdentity } = useIdentity();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<"list" | "a0" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const rootId = exportRootId || metaRootId || "";

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const downloadList = async () => {
    if (!people.length || !rootId) return;
    setPdfError(null);
    setPdfBusy("list");
    try {
      await exportListPdf(people, rootId, metaTitle || "Drzewo Potrykus");
      setMenuOpen(false);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfBusy(null);
    }
  };

  const downloadA0 = async () => {
    if (!people.length || !rootId) return;
    setPdfError(null);
    setPdfBusy("a0");
    try {
      await exportTreeA0Pdf(people, rootId, metaTitle || "Drzewo Potrykus");
      setMenuOpen(false);
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <div className="app-shell">
      <PrototypeBanner />
      <header className="app-header">
        <div className="app-header__top">
          <div className="app-header__brand">
            <Link href="/drzewo" className="brand-link">
              Drzewo Potrykus
            </Link>
            {typeof peopleCount === "number" && (
              <span className="people-count">{peopleCount} osób</span>
            )}
          </div>

          <div className="app-header__actions">
            {isAdmin ? (
              <Link
                href="/admin"
                className={`app-header__login${pathname.startsWith("/admin") ? " is-active" : ""}`}
              >
                Zgłoszenia
              </Link>
            ) : (
              <Link href="/login" className="app-header__login">
                Logowanie
              </Link>
            )}

            <div className="nav-menu" ref={menuRef}>
            <button
              type="button"
              className={`nav-menu__trigger${menuOpen ? " is-open" : ""}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((v) => !v)}
            >
              Menu
              <span aria-hidden>▾</span>
            </button>
            {menuOpen && (
              <div className="nav-menu__panel" role="menu">
                <p className="nav-menu__label">To ty</p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    promptIdentity();
                  }}
                >
                  {identity?.name
                    ? `${identity.name} · zmień`
                    : "Kim jesteś?"}
                </button>
                <div className="nav-menu__sep" />
                <p className="nav-menu__label">Wielkość tekstu</p>
                {(
                  [
                    ["normal", "Normalny"],
                    ["large", "Większy"],
                    ["xlarge", "Największy"],
                  ] as [TextScaleId, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={scale === id}
                    className={scale === id ? "is-checked" : undefined}
                    onClick={() => setScale(id)}
                  >
                    {label}
                    {scale === id ? " ✓" : ""}
                  </button>
                ))}
                <div className="nav-menu__sep" />
                <p className="nav-menu__label">Pobieranie</p>
                <button
                  type="button"
                  role="menuitem"
                  disabled={pdfBusy !== null || !rootId}
                  onClick={downloadList}
                >
                  {pdfBusy === "list" ? "Generuję…" : "PDF lista (A4)"}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={pdfBusy !== null || !rootId}
                  onClick={downloadA0}
                >
                  {pdfBusy === "a0" ? "Generuję…" : "PDF graf (A0)"}
                </button>
                <div className="nav-menu__sep" />
                {isAdmin ? (
                  <>
                    <Link
                      href="/admin"
                      role="menuitem"
                      className="nav-menu__link"
                      onClick={() => setMenuOpen(false)}
                    >
                      Zatwierdzanie zgłoszeń
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={adminLogout.isPending}
                      onClick={() => {
                        setMenuOpen(false);
                        adminLogout.mutate();
                      }}
                    >
                      Wyloguj administratora
                    </button>
                    <div className="nav-menu__sep" />
                  </>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  className="nav-menu__danger"
                  onClick={() => {
                    setMenuOpen(false);
                    logout.mutate();
                  }}
                >
                  Wyloguj
                </button>
              </div>
            )}
          </div>
          </div>
        </div>

        <nav className="app-nav" aria-label="Główne">
          {(
            [
              ["/drzewo", "Drzewo"],
              ["/lista", "Lista"],
              ["/urodziny", "Urodziny"],
              ["/spotkanie", "Spotkanie"],
              ["/zglos", "Zgłoś"],
              ["/pokrewienstwo", "Kto kim"],
            ] as const
          ).map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={pathname.startsWith(href) ? "is-active" : ""}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {pdfError && (
        <p className="banner-error banner-error--bar" role="alert">
          {pdfError}
        </p>
      )}

      <div className="app-main">{children}</div>
      <footer className="app-footer">
        Twórca: Adam Lieske · dane lokalne · dostęp kodem rodzinnym
      </footer>
    </div>
  );
}

export function AppShell({
  children,
  peopleCount,
  exportRootId,
}: {
  children: React.ReactNode;
  peopleCount?: number;
  exportRootId?: string;
}) {
  const family = useFamily(true);
  const people = family.data?.people ?? [];
  const enabled = Boolean(family.data && !family.isLoading);

  return (
    <IdentityProvider people={people} enabled={enabled}>
      <AppShellInner
        people={people}
        peopleCount={peopleCount}
        exportRootId={exportRootId}
        metaTitle={family.data?.meta?.title}
        metaRootId={family.data?.meta?.rootPersonId}
      >
        {children}
      </AppShellInner>
    </IdentityProvider>
  );
}
