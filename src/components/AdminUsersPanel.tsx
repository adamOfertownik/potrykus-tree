"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import type { AdminUserPublic, AdminUserRole } from "@/types/admin";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd sieci");
  return data as T;
}

const ROLE_LABELS: Record<AdminUserRole, string> = {
  admin: "Administrator",
  editor: "Edytor",
};

type RoleFilter = AdminUserRole | "all";

function formatDateTime(iso: string | null): string {
  if (!iso) return "jeszcze nie";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function AdminUsersPanel({
  currentUserId,
  onError,
  onSuccess,
}: {
  currentUserId: string;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
}) {
  const qc = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchJson<{ users: AdminUserPublic[] }>("/api/admin/users"),
  });
  const users = useMemo(
    () => usersQuery.data?.users ?? [],
    [usersQuery.data?.users],
  );
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [neverLoggedIn, setNeverLoggedIn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState<{
    id: string;
    email: string;
    role: AdminUserRole;
  } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailErrorId = "admin-user-email-error";

  const counts = useMemo(() => {
    let never = 0;
    const next = { admin: 0, editor: 0 };
    for (const user of users) {
      next[user.role] += 1;
      if (!user.lastLoginAt) never += 1;
    }
    return { ...next, never, all: users.length };
  }, [users]);

  const visible = users.filter((user) => {
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    if (neverLoggedIn && user.lastLoginAt) return false;
    const q = query.trim().toLowerCase();
    if (q && !user.email.toLowerCase().includes(q)) return false;
    return true;
  });

  const selected =
    visible.find((u) => u.id === selectedId) ?? visible[0] ?? null;

  if (selected && draft?.id !== selected.id) {
    setDraft({ id: selected.id, email: selected.email, role: selected.role });
    setEmailError(null);
  } else if (!selected && draft) {
    setDraft(null);
  }

  const form = draft ?? { email: "", role: "editor" as AdminUserRole };

  const refreshAuthIfSelf = async (user: AdminUserPublic) => {
    if (user.id === currentUserId) {
      await qc.invalidateQueries({ queryKey: ["admin-auth-status"] });
    }
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    onError(null);
    onSuccess(null);
    setEmailError(null);
    try {
      const res = await fetch(`/api/admin/users/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, role: form.role }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.error === "string" && data.error.includes("e-mail")) {
          setEmailError(data.error);
        }
        throw new Error(data.error || "Błąd zapisu");
      }
      const user = data.user as AdminUserPublic;
      qc.setQueryData(["admin-users"], {
        users: users.map((u) => (u.id === user.id ? user : u)),
      });
      setDraft({ id: user.id, email: user.email, role: user.role });
      await refreshAuthIfSelf(user);
      onSuccess("Zapisano konto.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setBusy(true);
    onError(null);
    onSuccess(null);
    try {
      const res = await fetch(`/api/admin/users/${selected.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd usuwania");
      const next = users.filter((u) => u.id !== selected.id);
      qc.setQueryData(["admin-users"], { users: next });
      setSelectedId(next[0]?.id ?? null);
      setDeleteOpen(false);
      onSuccess("Usunięto konto.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const filtersActive = roleFilter !== "all" || neverLoggedIn || query.trim().length > 0;

  const clearFilters = () => {
    setRoleFilter("all");
    setNeverLoggedIn(false);
    setQuery("");
  };

  return (
    <div className="admin-workspace">
      <div className="admin-card-box">
        <p className="admin-users__hint">
          Hasło zapisujemy jako skrót (bcrypt), nie w jawnej postaci. Na razie
          może być łatwe — minimum 8 znaków. Przypomnienia hasła nie ma, bo nie
          mamy jeszcze wysyłki e-maili: przekaż dane do logowania osobiście.
        </p>
        <div className="admin-toolbar">
          <label className="field-block">
            Szukaj
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e-mail konta"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            Nowe konto
          </button>
        </div>
        <div className="admin-filters" role="group" aria-label="Filtry kont">
          <button
            type="button"
            aria-pressed={roleFilter === "all"}
            onClick={() => setRoleFilter("all")}
          >
            Wszystkie ({counts.all})
          </button>
          <button
            type="button"
            aria-pressed={roleFilter === "admin"}
            onClick={() => setRoleFilter("admin")}
          >
            Administratorzy ({counts.admin})
          </button>
          <button
            type="button"
            aria-pressed={roleFilter === "editor"}
            onClick={() => setRoleFilter("editor")}
          >
            Edytorzy ({counts.editor})
          </button>
          <button
            type="button"
            aria-pressed={neverLoggedIn}
            onClick={() => setNeverLoggedIn((v) => !v)}
          >
            Bez logowania ({counts.never})
          </button>
        </div>
        <ul className="admin-list-box">
          {usersQuery.isPending && (
            <li className="admin-list-empty">Ładowanie rejestru…</li>
          )}
          {usersQuery.isError && (
            <li className="admin-list-empty" role="alert">
              {(usersQuery.error as Error).message || "Nie udało się wczytać kont."}
            </li>
          )}
          {!usersQuery.isPending &&
            !usersQuery.isError &&
            visible.length === 0 && (
            <li className="admin-list-empty">
              {query.trim()
                ? `Brak kont dla „${query.trim()}”.`
                : "Brak kont w tym widoku."}{" "}
              {filtersActive ? (
                <button type="button" className="btn-text" onClick={clearFilters}>
                  Pokaż wszystkie
                </button>
              ) : (
                "Dodaj pierwsze konto przyciskiem powyżej."
              )}
            </li>
          )}
          {visible.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className={`admin-row${user.id === selected?.id ? " is-selected" : ""}`}
                aria-current={user.id === selected?.id ? "true" : undefined}
                onClick={() => setSelectedId(user.id)}
              >
                <span className="admin-row__title">
                  {user.email}
                  {user.id === currentUserId ? (
                    <span className="admin-row__you">to Ty</span>
                  ) : null}
                </span>
                <span className="admin-row__meta">
                  <span
                    className={`admin-role-badge${user.role === "editor" ? " admin-role-badge--editor" : ""}`}
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                  <span>
                    logowanie: {formatDateTime(user.lastLoginAt)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <article className="admin-detail">
          <header className="admin-detail__head">
            <h2>{selected.email}</h2>
            <span
              className={`admin-role-badge${selected.role === "editor" ? " admin-role-badge--editor" : ""}`}
            >
              {ROLE_LABELS[selected.role]}
            </span>
          </header>
          <dl className="admin-users__facts">
            <div>
              <dt>Ostatnie logowanie</dt>
              <dd>{formatDateTime(selected.lastLoginAt)}</dd>
            </div>
            <div>
              <dt>Konto od</dt>
              <dd>{formatDateTime(selected.createdAt)}</dd>
            </div>
          </dl>
          <form
            className="change-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="field-block" htmlFor="admin-user-email">
              E-mail
              <input
                id="admin-user-email"
                type="email"
                required
                value={form.email}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? emailErrorId : undefined}
                onChange={(e) => {
                  const email = e.target.value;
                  setDraft((s) =>
                    s ? { ...s, email } : { id: selected.id, email, role: selected.role },
                  );
                  setEmailError(null);
                }}
              />
            </label>
            {emailError && (
              <p id={emailErrorId} className="field-error">
                {emailError}
              </p>
            )}
            <label className="field-block" htmlFor="admin-user-role">
              Rola
              <select
                id="admin-user-role"
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as AdminUserRole;
                  setDraft((s) =>
                    s ? { ...s, role } : { id: selected.id, email: selected.email, role },
                  );
                }}
              >
                <option value="admin">{ROLE_LABELS.admin}</option>
                <option value="editor">{ROLE_LABELS.editor}</option>
              </select>
            </label>
            <div className="admin-card__actions">
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Zapisuję…" : "Zapisz"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setPasswordOpen(true)}
              >
                Nowe hasło
              </button>
            </div>
            <div className="admin-users__danger">
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy || selected.id === currentUserId}
                onClick={() => setDeleteOpen(true)}
              >
                Usuń konto
              </button>
              {selected.id === currentUserId && (
                <p className="empty-hint">Własnego konta nie da się usunąć.</p>
              )}
            </div>
          </form>
        </article>
      ) : (
        <p className="admin-card-box admin-list-empty">
          Wybierz konto z listy albo dodaj nowe.
        </p>
      )}

      {createOpen && (
        <CreateUserModal
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            setBusy(true);
            onError(null);
            onSuccess(null);
            try {
              const res = await fetch("/api/admin/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Błąd");
              const user = data.user as AdminUserPublic;
              qc.setQueryData(["admin-users"], {
                users: [...users, user].sort((a, b) =>
                  a.email.localeCompare(b.email, "pl"),
                ),
              });
              setSelectedId(user.id);
              setCreateOpen(false);
              onSuccess("Dodano użytkownika.");
            } catch (e) {
              throw e instanceof Error ? e : new Error("Błąd");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {passwordOpen && selected && (
        <PasswordModal
          busy={busy}
          email={selected.email}
          onClose={() => setPasswordOpen(false)}
          onSave={async (password) => {
            setBusy(true);
            onError(null);
            onSuccess(null);
            try {
              const res = await fetch(`/api/admin/users/${selected.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Błąd");
              setPasswordOpen(false);
              onSuccess("Ustawiono nowe hasło.");
            } catch (e) {
              throw e instanceof Error ? e : new Error("Błąd");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {deleteOpen && selected && (
        <Modal
          open
          labelledBy="admin-user-delete-title"
          onClose={() => setDeleteOpen(false)}
        >
          <h2 id="admin-user-delete-title">Usunąć {selected.email}?</h2>
          <p>
            Konto straci dostęp do panelu. Tego nie da się cofnąć z tego okna.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => void remove()}
            >
              Usuń na stałe
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteOpen(false)}
            >
              Anuluj
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateUserModal({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: {
    email: string;
    password: string;
    role: AdminUserRole;
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminUserRole>("editor");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const emailErrorId = "create-user-email-error";
  const passwordErrorId = "create-user-password-error";
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (localError) errorRef.current?.focus();
  }, [localError]);

  const validate = () => {
    let ok = true;
    setEmailError(null);
    setPasswordError(null);
    if (!email.trim() || !email.includes("@")) {
      setEmailError("Podaj prawidłowy e-mail.");
      ok = false;
    }
    if (password.length < 8) {
      setPasswordError("Hasło musi mieć co najmniej 8 znaków.");
      ok = false;
    }
    return ok;
  };

  return (
    <Modal open labelledBy="admin-user-create-title" onClose={onClose}>
      <form
        className="change-form"
        onSubmit={(e) => {
          e.preventDefault();
          setLocalError(null);
          if (!validate()) {
            setLocalError("Uzupełnij poprawnie pola poniżej.");
            return;
          }
          void onCreate({ email, password, role }).catch((err: Error) => {
            setLocalError(err.message);
          });
        }}
      >
        <h2 id="admin-user-create-title">Nowy użytkownik</h2>
        {localError && (
          <div
            ref={errorRef}
            className="banner-error"
            role="alert"
            tabIndex={-1}
          >
            {localError}
          </div>
        )}
        <label className="field-block" htmlFor="create-user-email">
          E-mail
          <input
            id="create-user-email"
            type="email"
            required
            autoComplete="off"
            value={email}
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? emailErrorId : undefined}
            onBlur={() => {
              if (email && !email.includes("@")) {
                setEmailError("Podaj prawidłowy e-mail.");
              }
            }}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
          />
        </label>
        {emailError && (
          <p id={emailErrorId} className="field-error">
            {emailError}
          </p>
        )}
        <label className="field-block" htmlFor="create-user-password">
          Hasło
          <span className="password-field">
            <input
              id="create-user-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? passwordErrorId : undefined}
              onBlur={() => {
                if (password && password.length < 8) {
                  setPasswordError("Hasło musi mieć co najmniej 8 znaków.");
                }
              }}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(null);
              }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            >
              {showPassword ? "Ukryj" : "Pokaż"}
            </button>
          </span>
        </label>
        {passwordError && (
          <p id={passwordErrorId} className="field-error">
            {passwordError}
          </p>
        )}
        <label className="field-block" htmlFor="create-user-role">
          Rola
          <select
            id="create-user-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminUserRole)}
          >
            <option value="editor">{ROLE_LABELS.editor}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </select>
        </label>
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Dodaj
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Anuluj
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({
  busy,
  email,
  onClose,
  onSave,
}: {
  busy: boolean;
  email: string;
  onClose: () => void;
  onSave: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const passwordErrorId = "reset-user-password-error";

  useEffect(() => {
    if (localError) errorRef.current?.focus();
  }, [localError]);

  return (
    <Modal open labelledBy="admin-user-password-title" onClose={onClose}>
      <form
        className="change-form"
        onSubmit={(e) => {
          e.preventDefault();
          setLocalError(null);
          if (password.length < 8) {
            setPasswordError("Hasło musi mieć co najmniej 8 znaków.");
            setLocalError("Uzupełnij poprawnie pola poniżej.");
            return;
          }
          void onSave(password).catch((err: Error) => {
            setLocalError(err.message);
          });
        }}
      >
        <h2 id="admin-user-password-title">Nowe hasło</h2>
        <p>Ustaw hasło dla {email}.</p>
        {localError && (
          <div
            ref={errorRef}
            className="banner-error"
            role="alert"
            tabIndex={-1}
          >
            {localError}
          </div>
        )}
        <label className="field-block" htmlFor="reset-user-password">
          Nowe hasło
          <span className="password-field">
            <input
              id="reset-user-password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? passwordErrorId : undefined}
              onBlur={() => {
                if (password && password.length < 8) {
                  setPasswordError("Hasło musi mieć co najmniej 8 znaków.");
                }
              }}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(null);
              }}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            >
              {showPassword ? "Ukryj" : "Pokaż"}
            </button>
          </span>
        </label>
        {passwordError && (
          <p id={passwordErrorId} className="field-error">
            {passwordError}
          </p>
        )}
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Zapisz hasło
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Anuluj
          </button>
        </div>
      </form>
    </Modal>
  );
}
