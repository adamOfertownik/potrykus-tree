"use client";

import { useEffect, useState, type FormEvent } from "react";

type AdminRole = "admin" | "pay";

type AdminUserPublic = {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
  lastLoginAt: string | null;
};

type UsersPayload = {
  users: AdminUserPublic[];
  currentAdminId: string;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "jeszcze nie logował się";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminUsersPanel({
  currentEmail,
  onError,
  onSuccess,
}: {
  currentEmail: string;
  onError: (msg: string | null) => void;
  onSuccess: (msg: string | null) => void;
}) {
  const [users, setUsers] = useState<AdminUserPublic[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [role, setRole] = useState<AdminRole>("pay");
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    onError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = (await res.json()) as UsersPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "Błąd wczytywania kont");
      setUsers(data.users || []);
      setCurrentAdminId(data.currentAdminId || "");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first paint only
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      onError("Hasła nie są takie same.");
      return;
    }
    setBusy(true);
    onError(null);
    onSuccess(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      setUsers((list) => [...list, data.user]);
      setEmail("");
      setPassword("");
      setPassword2("");
      setRole("pay");
      onSuccess(
        data.user.role === "pay"
          ? `Dodano konto wpłat ${data.user.email}. Ciocia loguje się na stronie Logowanie i w panelu widzi tylko płatności — tam oznacza, kto wpłacił.`
          : `Dodano konto ${data.user.email}. Przekaż hasło osobiście.`,
      );
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (id: string) => {
    if (newPw !== newPw2) {
      onError("Hasła nie są takie same.");
      return;
    }
    setBusy(true);
    onError(null);
    onSuccess(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      setPwFor(null);
      setNewPw("");
      setNewPw2("");
      onSuccess(`Zmieniono hasło dla ${data.user.email}.`);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    onError(null);
    onSuccess(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      setUsers((list) => list.filter((u) => u.id !== id));
      setConfirmId(null);
      onSuccess("Usunięto konto administratora.");
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-users">
      <section>
        <h2>Nowe konto</h2>
        <p className="admin-users__hint">
          Hasło zapisujemy jako skrót (bcrypt), nie w jawnej postaci. Minimum 8
          znaków. Dla cioci wybierz „Tylko wpłaty”: zaloguje się tym e-mailem i
          hasłem, a w panelu zaznaczy kto jej wpłacił. Przypomnienia hasła nie
          ma — przekaż dane osobiście. Kont testowych (np. @potrykus.invalid)
          nie zakładamy i usuwamy je z bazy.
        </p>
        <form className="change-form admin-users__form" onSubmit={create}>
          <label className="field-block">
            E-mail
            <input
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="field-block">
            Hasło
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <label className="field-block">
            Powtórz hasło
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              required
            />
          </label>
          <fieldset className="admin-users__role">
            <legend>Uprawnienia</legend>
            <label className="check-row">
              <input
                type="radio"
                name="new-admin-role"
                checked={role === "pay"}
                onChange={() => setRole("pay")}
              />
              Tylko wpłaty (ciocia)
            </label>
            <label className="check-row">
              <input
                type="radio"
                name="new-admin-role"
                checked={role === "admin"}
                onChange={() => setRole("admin")}
              />
              Pełny administrator (zgłoszenia, drzewo, konta)
            </label>
          </fieldset>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Zapisuję…" : "Dodaj administratora"}
          </button>
        </form>
      </section>

      <section>
        <h2>Administratorzy ({users.length})</h2>
        {loading ? (
          <p className="empty-hint">Ładowanie…</p>
        ) : users.length === 0 ? (
          <p className="empty-hint">Brak kont w bazie.</p>
        ) : (
          <ul className="admin-users-cards">
            {users.map((user) => {
              const isYou =
                user.id === currentAdminId ||
                user.email.toLowerCase() === currentEmail.toLowerCase();
              const onlyOne = users.length <= 1;
              return (
                <li key={user.id} className={isYou ? "is-you" : undefined}>
                  <div>
                    <strong>{user.email}</strong>
                    {isYou ? <span className="admin-users__you">To Ty</span> : null}
                    <span className="admin-users__role-tag">
                      {user.role === "pay" ? "Tylko wpłaty" : "Pełny dostęp"}
                    </span>
                    <p>
                      Dodane {formatWhen(user.createdAt)}. Ostatnie logowanie:{" "}
                      {formatWhen(user.lastLoginAt)}.
                    </p>
                  </div>
                  <div className="admin-users-cards__actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        setConfirmId(null);
                        setPwFor(pwFor === user.id ? null : user.id);
                        setNewPw("");
                        setNewPw2("");
                      }}
                    >
                      Zmień hasło
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busy || isYou || onlyOne}
                      title={
                        isYou
                          ? "Nie możesz usunąć własnego konta."
                          : onlyOne
                            ? "Nie można usunąć ostatniego administratora."
                            : undefined
                      }
                      onClick={() => {
                        setPwFor(null);
                        setConfirmId(confirmId === user.id ? null : user.id);
                      }}
                    >
                      Usuń
                    </button>
                  </div>
                  {pwFor === user.id ? (
                    <div className="admin-users__pw">
                      <label className="field-block">
                        Nowe hasło
                        <input
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                        />
                      </label>
                      <label className="field-block">
                        Powtórz nowe hasło
                        <input
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          value={newPw2}
                          onChange={(e) => setNewPw2(e.target.value)}
                        />
                      </label>
                      <div className="admin-users-cards__actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy || newPw.length < 8}
                          onClick={() => void changePassword(user.id)}
                        >
                          Zapisz hasło
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setPwFor(null)}
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {confirmId === user.id ? (
                    <div className="admin-users__pw">
                      <p>
                        Usunąć konto <strong>{user.email}</strong>? Ta osoba
                        nie zaloguje się już jako admin.
                      </p>
                      <div className="admin-users-cards__actions">
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busy}
                          onClick={() => void remove(user.id)}
                        >
                          Usuń na stałe
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setConfirmId(null)}
                        >
                          Anuluj
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
