"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeSubmission } from "@/types/submissions";
import type { UserRole } from "@/types/auth";
import { useAuthStatus, useLogout } from "@/lib/hooks";

type AccessLinkKind = "member" | "admin" | "view";

type LinkStatus = { enabled: boolean; updatedAt: string | null };

type AdminStatus = {
  storage: "neon" | "file";
  tree: {
    source: "neon" | "markdown";
    peopleCount: number;
    graphTable: boolean;
  };
  users: { admin: number; member: number };
  links: {
    member: LinkStatus;
    admin: LinkStatus;
    view: LinkStatus;
  };
};

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

function roleLabel(role: UserRole) {
  return role === "admin" ? "Admin" : "Rodzina";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd sieci");
  return data as T;
}

function InviteKindForm({
  title,
  hint,
  kind,
  enabled,
  link,
  code,
  onCode,
  onGenerate,
  onSave,
  onClear,
  pending,
}: {
  title: string;
  hint: string;
  kind: AccessLinkKind;
  enabled: boolean;
  link: string;
  code: string;
  onCode: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  onClear: () => void;
  pending: boolean;
}) {
  return (
    <div className="admin-card">
      <div className="admin-card__head">
        <strong>{title}</strong>
        <span className="admin-card__status">
          {enabled ? "włączony" : "wyłączony"}
        </span>
      </div>
      <p className="empty-hint">{hint}</p>
      {link ? (
        <label className="field-block">
          Link do skopiowania
          <input
            className="gate-input"
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      ) : null}
      {link ? (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            void navigator.clipboard.writeText(link);
          }}
        >
          Kopiuj link
        </button>
      ) : null}
      <form
        className="admin-user-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={onGenerate}
        >
          {pending ? "Zapisuję…" : "Wygeneruj nowy link"}
        </button>
        <label className="field-block">
          Albo własne hasło / klucz (min. 8 znaków)
          <input
            type="password"
            className="gate-input"
            value={code}
            onChange={(e) => onCode(e.target.value)}
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <button
          type="submit"
          className="btn btn-secondary"
          disabled={pending || code.trim().length < 8}
        >
          Zapisz własne
        </button>
        {enabled ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={onClear}
          >
            Wyłącz {kind === "view" ? "hasło" : "ten link"}
          </button>
        ) : null}
      </form>
    </div>
  );
}

function AdminPanel({ email }: { email: string }) {
  const logout = useLogout();
  const router = useRouter();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("member");
  const [newName, setNewName] = useState("");
  const [inviteLinks, setInviteLinks] = useState<
    Partial<Record<AccessLinkKind, string>>
  >({});
  const [inviteCodes, setInviteCodes] = useState<
    Record<AccessLinkKind, string>
  >({ member: "", admin: "", view: "" });

  const submissionsQ = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: () =>
      fetchJson<{ submissions: ChangeSubmission[] }>("/api/admin/submissions"),
  });
  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchJson<{ users: UserRow[] }>("/api/admin/users"),
  });

  const statusMut = useMutation({
    mutationFn: (input: { id: string; status: ChangeSubmission["status"] }) =>
      fetchJson<{ submission: ChangeSubmission }>("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-submissions"] }),
  });

  const createMut = useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      role: UserRole;
      displayName?: string;
    }) =>
      fetchJson<{ user: UserRow }>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("member");
      setNotice(
        `Utworzono konto ${data.user.email} (${roleLabel(data.user.role)}).`,
      );
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const adminStatusQ = useQuery({
    queryKey: ["admin-status"],
    queryFn: () => fetchJson<AdminStatus>("/api/admin/status"),
  });

  const inviteQ = useQuery({
    queryKey: ["admin-invite"],
    queryFn: () =>
      fetchJson<{
        member: LinkStatus;
        admin: LinkStatus;
        view: LinkStatus;
        enabled: boolean;
        familyLinksBlockedByVercelAuth?: boolean;
        vercelPreview?: boolean;
        shareOrigin?: string | null;
      }>("/api/admin/invite"),
  });

  const inviteMut = useMutation({
    mutationFn: (body: {
      type: AccessLinkKind;
      generate?: boolean;
      code?: string;
    }) =>
      fetchJson<{
        ok: boolean;
        type: AccessLinkKind;
        token?: string;
        path?: string;
        url?: string;
        vercelPreview?: boolean;
      }>("/api/admin/invite", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      setInviteCodes((prev) => ({ ...prev, [data.type]: "" }));
      if (data.path) {
        const url =
          data.url || `${window.location.origin}${data.path}`;
        setInviteLinks((prev) => ({ ...prev, [data.type]: url }));
        setNotice(
          data.vercelPreview
            ? "Skopiuj link, ale nie wysyłaj tego adresu rodzinie: podgląd Vercel wymaga logowania Vercel (incognito = okno logowania, nie rejestracja). Wyłącz Vercel Authentication albo ustaw NEXT_PUBLIC_APP_URL na produkcję."
            : "Skopiuj link teraz. W bazie zostaje tylko hash — po odświeżeniu panelu samego adresu stąd nie odzyskasz (hasło własne pamiętasz Ty).",
        );
      } else {
        setNotice("Zapisano klucz (w bazie jest tylko hash).");
      }
      void qc.invalidateQueries({ queryKey: ["admin-invite"] });
      void qc.invalidateQueries({ queryKey: ["admin-status"] });
    },
  });

  const importMdMut = useMutation({
    mutationFn: (body: FormData) =>
      fetch("/api/admin/family-import", { method: "POST", body }).then(
        async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Błąd importu");
          return data as { people: number };
        },
      ),
    onSuccess: (data) => {
      setNotice(`Wgrano drzewo (${data.people} osób) do Neona.`);
      void qc.invalidateQueries({ queryKey: ["family"] });
    },
  });

  const seedMut = useMutation({
    mutationFn: () =>
      fetchJson<{
        ok: boolean;
        tree: AdminStatus["tree"];
      }>("/api/admin/family-seed", { method: "POST" }),
    onSuccess: (data) => {
      setNotice(
        data.tree.source === "neon"
          ? `Drzewo w Neon (${data.tree.peopleCount} osób).`
          : "Nadal czytam załączony Markdown — tabela w Neon jest pusta.",
      );
      void qc.invalidateQueries({ queryKey: ["admin-status"] });
      void qc.invalidateQueries({ queryKey: ["family"] });
    },
  });

  const inviteClearMut = useMutation({
    mutationFn: (type: AccessLinkKind) =>
      fetchJson<{ ok: boolean }>(`/api/admin/invite?type=${type}`, {
        method: "DELETE",
      }),
    onSuccess: (_data, type) => {
      setInviteLinks((prev) => ({ ...prev, [type]: "" }));
      setNotice("Ten link / hasło zostało wyłączone.");
      void qc.invalidateQueries({ queryKey: ["admin-invite"] });
      void qc.invalidateQueries({ queryKey: ["admin-status"] });
    },
  });

  const roleMut = useMutation({
    mutationFn: (input: { id: string; role: UserRole }) =>
      fetchJson<{ user: UserRow }>("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const items = submissionsQ.data?.submissions ?? [];
  const users = usersQ.data?.users ?? [];
  const error =
    submissionsQ.error ||
    usersQ.error ||
    inviteQ.error ||
    adminStatusQ.error ||
    statusMut.error ||
    createMut.error ||
    roleMut.error ||
    inviteMut.error ||
    inviteClearMut.error ||
    importMdMut.error ||
    seedMut.error;
  const busy =
    statusMut.isPending ||
    createMut.isPending ||
    roleMut.isPending ||
    inviteMut.isPending ||
    inviteClearMut.isPending;

  return (
    <section className="admin-page">
      <header className="admin-page__intro">
        <h1>Panel administratora</h1>
        <p>
          Zalogowany jako <strong>{email}</strong>. Na MVP wystarczy, że konta
          mają admini. Rodzina ogląda drzewo hasłem. Osobny link zakłada kolejne
          konto admina, drugi — konto standardowe (jak dotychczas).
        </p>
        <div className="admin-page__toolbar">
          <Link href="/drzewo" className="btn btn-secondary">
            ← Do drzewa
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={logout.isPending}
            onClick={() => {
              logout.mutate(undefined, {
                onSuccess: () => router.push("/login"),
              });
            }}
          >
            Wyloguj
          </button>
        </div>
      </header>

      {error && (
        <p className="banner-error" role="alert">
          {(error as Error).message}
        </p>
      )}
      {notice && (
        <p className="banner-success" role="status">
          {notice}
        </p>
      )}

      <section className="admin-users">
        <h2>Stan bazy i drzewa</h2>
        <p className="empty-hint">
          {adminStatusQ.data
            ? adminStatusQ.data.tree.source === "neon"
              ? `Drzewo jest w Neon (${adminStatusQ.data.tree.peopleCount} osób).`
              : `Drzewo idzie z załączonego Markdownu (${adminStatusQ.data.tree.peopleCount} osób)${adminStatusQ.data.tree.graphTable ? ", tabela family_graph jest pusta" : " — brak tabeli family_graph"}.`
            : "Sprawdzam Neon…"}
        </p>
        <p className="empty-hint">
          Konta: {adminStatusQ.data?.users.admin ?? "—"} adminów,{" "}
          {adminStatusQ.data?.users.member ?? "—"} standardowych. Magazyn:{" "}
          {adminStatusQ.data?.storage ?? "—"}.
        </p>
        <p className="empty-hint">
          Clerk na MVP nie jest potrzebny — już jest Neon i sesja. Darmowy plan
          Clerka to kolejny vendor i klucze, a gość i tak ogląda drzewo hasłem.
        </p>
        {adminStatusQ.data?.tree.source !== "neon" ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={seedMut.isPending}
            onClick={() => {
              setNotice(null);
              seedMut.mutate();
            }}
          >
            {seedMut.isPending
              ? "Zapisuję do Neona…"
              : "Zapisz drzewo z Markdownu do Neona"}
          </button>
        ) : null}
      </section>

      <section className="admin-users">
        <h2>Trzy wejścia dla rodziny</h2>
        <p className="empty-hint">
          Większość osób nie zakłada konta. Daj im hasło albo link do drzewa.
          Osobno wyślij link adminom i (opcjonalnie) osobom, które mają mieć
          zwykłe konto.
        </p>
        {inviteQ.data?.familyLinksBlockedByVercelAuth ? (
          <p className="admin-banner" role="status">
            Ten panel jest na <strong>podglądzie Vercel</strong>. Link z hashem
            w adresie (np. <code>…-jt48m1bro-…vercel.app</code>) w oknie
            incognito otwiera <strong>logowanie Vercel</strong>, nie rejestrację.
            Rodzina nie ma konta Vercel. W projekcie: Deployment Protection →
            Vercel Authentication → wyłącz (drzewo i tak chroni hasło / klucz z
            aplikacji). Albo zmerguj na produkcję i ustaw{" "}
            <code>NEXT_PUBLIC_APP_URL</code> na publiczny adres.
          </p>
        ) : null}
        <InviteKindForm
          kind="view"
          title="Hasło / link do drzewa (bez konta)"
          hint="Adres /wejscie?k=… albo własne hasło na stronie logowania. Gość widzi drzewo, listę i zjazd — bez e-maila."
          enabled={Boolean(inviteQ.data?.view.enabled)}
          link={inviteLinks.view || ""}
          code={inviteCodes.view}
          onCode={(value) =>
            setInviteCodes((prev) => ({ ...prev, view: value }))
          }
          onGenerate={() => {
            setNotice(null);
            inviteMut.mutate({ type: "view", generate: true });
          }}
          onSave={() => {
            setNotice(null);
            inviteMut.mutate({ type: "view", code: inviteCodes.view });
          }}
          onClear={() => inviteClearMut.mutate("view")}
          pending={inviteMut.isPending || inviteClearMut.isPending}
        />
        <InviteKindForm
          kind="admin"
          title="Link dla kolejnego admina"
          hint="Otwiera /register?k=…&rola=admin i zakłada konto z pełnymi uprawnieniami. Nie mieszaj z hasłem do drzewa."
          enabled={Boolean(inviteQ.data?.admin.enabled)}
          link={inviteLinks.admin || ""}
          code={inviteCodes.admin}
          onCode={(value) =>
            setInviteCodes((prev) => ({ ...prev, admin: value }))
          }
          onGenerate={() => {
            setNotice(null);
            inviteMut.mutate({ type: "admin", generate: true });
          }}
          onSave={() => {
            setNotice(null);
            inviteMut.mutate({ type: "admin", code: inviteCodes.admin });
          }}
          onClear={() => inviteClearMut.mutate("admin")}
          pending={inviteMut.isPending || inviteClearMut.isPending}
        />
        <InviteKindForm
          kind="member"
          title="Link na konto standardowe"
          hint="Tak jak dotychczas: /register?k=… zakłada konto rodziny (zgłoszenia, zjazd z loginem). Stary pojedynczy klucz z bazy nadal tu działa po migracji."
          enabled={Boolean(inviteQ.data?.member.enabled)}
          link={inviteLinks.member || ""}
          code={inviteCodes.member}
          onCode={(value) =>
            setInviteCodes((prev) => ({ ...prev, member: value }))
          }
          onGenerate={() => {
            setNotice(null);
            inviteMut.mutate({ type: "member", generate: true });
          }}
          onSave={() => {
            setNotice(null);
            inviteMut.mutate({ type: "member", code: inviteCodes.member });
          }}
          onClear={() => inviteClearMut.mutate("member")}
          pending={inviteMut.isPending || inviteClearMut.isPending}
        />
      </section>

      <section className="admin-users">
        <h2>Drzewo z pliku Markdown</h2>
        <p className="empty-hint">
          Jeśli w Neon nie ma grafu, aplikacja czyta załączony raport. Wgraj
          nowy <strong>.md</strong>, żeby nadpisać osoby, rodziców i małżeństwa
          w bazie.
        </p>
        <form
          className="admin-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem(
              "mdfile",
            ) as HTMLInputElement | null;
            const file = input?.files?.[0];
            if (!file) {
              setNotice(null);
              return;
            }
            const body = new FormData();
            body.append("file", file);
            setNotice(null);
            importMdMut.mutate(body);
          }}
        >
          <label className="field-block">
            Plik .md
            <input name="mdfile" type="file" accept=".md,text/markdown,text/plain" />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={importMdMut.isPending}
          >
            {importMdMut.isPending ? "Wczytuję…" : "Wgraj drzewo do bazy"}
          </button>
        </form>
      </section>

      <section className="admin-users">
        <h2>Konta rodziny</h2>
        <p className="empty-hint">
          <strong>Rodzina</strong> (konto) widzi drzewo, zgłasza poprawki i
          zapisuje się na spotkanie. <strong>Gość</strong> (hasło do drzewa)
          ogląda to samo bez e-maila. <strong>Admin</strong> edytuje graf i
          zaprasza kolejnych adminów. Na zjazd nie każdy musi mieć konto.
        </p>
        <form
          className="admin-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(null);
            createMut.mutate({
              email: newEmail,
              password: newPassword,
              role: newRole,
              displayName: newName || undefined,
            });
          }}
        >
          <label className="field-block">
            E-mail
            <input
              type="email"
              className="gate-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <label className="field-block">
            Hasło (min. 8 znaków)
            <input
              type="password"
              className="gate-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="field-block">
            Imię (opcjonalnie)
            <input
              type="text"
              className="gate-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label className="field-block">
            Rola
            <select
              className="gate-input"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              <option value="member">Rodzina</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMut.isPending}
          >
            {createMut.isPending ? "Zapisuję…" : "Dodaj konto"}
          </button>
        </form>
        <ul className="admin-list">
          {users.map((u) => (
            <li key={u.id} className="admin-card">
              <div className="admin-card__head">
                <strong>{u.displayName || u.email}</strong>
                <span className="admin-card__status">{roleLabel(u.role)}</span>
              </div>
              {u.displayName ? <p className="empty-hint">{u.email}</p> : null}
              <div className="admin-card__actions">
                {u.role === "admin" ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => roleMut.mutate({ id: u.id, role: "member" })}
                  >
                    Zrób członkiem rodziny
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => roleMut.mutate({ id: u.id, role: "admin" })}
                  >
                    Nadaj admina
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <h2>Zgłoszenia</h2>
      <p className="empty-hint">{items.length} zgłoszeń</p>
      <ul className="admin-list">
        {items.map((s) => (
          <li key={s.id} className="admin-card">
            <div className="admin-card__head">
              <strong>{s.reporterName}</strong>
              <span>{s.kind}</span>
              <span className="admin-card__status">{s.status}</span>
            </div>
            <p>{s.message || "(bez opisu)"}</p>
            {s.targetPersonName && (
              <p className="empty-hint">Dotyczy: {s.targetPersonName}</p>
            )}
            <div className="admin-card__actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  statusMut.mutate({ id: s.id, status: "reviewed" })
                }
              >
                Przejrzane
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  statusMut.mutate({ id: s.id, status: "accepted" })
                }
              >
                Akceptuj
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  statusMut.mutate({ id: s.id, status: "rejected" })
                }
              >
                Odrzuć
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminPageClient() {
  const auth = useAuthStatus();
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.data?.unlocked) {
      router.replace("/login?next=/admin");
      return;
    }
    if (auth.data.role !== "admin") {
      router.replace("/drzewo");
    }
  }, [auth.isLoading, auth.data, router]);

  if (
    auth.isLoading ||
    !auth.data?.unlocked ||
    auth.data.role !== "admin" ||
    !auth.data.email
  ) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return (
    <main className="page-shell">
      <AdminPanel email={auth.data.email} />
    </main>
  );
}
