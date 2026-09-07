"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { loadReporter, saveReporter } from "@/lib/reporter";
import type { EventPhoto } from "@/types/event";

const CONTACT_EMAIL = "maciej.lieder@gmail.com";
const MAX_FILE_MB = 4;

type PhotosApi = {
  storage?: string;
  photos: EventPhoto[];
};

async function fetchPhotos(): Promise<PhotosApi> {
  const res = await fetch("/api/photos");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd wczytywania zdjęć");
  return data as PhotosApi;
}

type QueueItem = {
  id: string;
  name: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

export function PhotosPageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const qc = useQueryClient();
  const photosQ = useQuery({
    queryKey: ["event-photos"],
    queryFn: fetchPhotos,
    enabled: unlocked,
  });

  const [uploaderName, setUploaderName] = useState("");
  const [caption, setCaption] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const r = loadReporter();
    if (r?.name) setUploaderName(r.name);
  }, []);

  if (auth.isLoading) return <div className="loading-screen">Ładowanie…</div>;
  if (!auth.data?.unlocked) return <AccessGate />;
  if (family.isLoading || photosQ.isLoading || !family.data) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie zdjęć…</div>
      </AppShell>
    );
  }

  const photos = photosQ.data?.photos ?? [];

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!uploaderName.trim()) {
      setError("Podaj swoje imię i nazwisko, żeby podpisać zdjęcia.");
      return;
    }
    setError(null);
    setSuccess(null);
    setBusy(true);
    saveReporter({ name: uploaderName.trim() });

    const items: QueueItem[] = Array.from(files).map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      status: "pending",
    }));
    setQueue(items);

    let okCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setQueue((q) =>
        q.map((it) => (it.id === items[i].id ? { ...it, status: "uploading" } : it)),
      );
      try {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          throw new Error(`Plik za duży (limit ${MAX_FILE_MB} MB).`);
        }
        const form = new FormData();
        form.append("file", file);
        const uploadRes = await fetch("/api/photos/upload", {
          method: "POST",
          body: form,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Upload nieudany");

        const saveRes = await fetch("/api/photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: uploadData.url,
            uploaderName: uploaderName.trim(),
            caption: caption.trim() || undefined,
          }),
        });
        const saveData = await saveRes.json();
        if (!saveRes.ok) throw new Error(saveData.error || "Nie udało się zapisać.");

        okCount += 1;
        setQueue((q) =>
          q.map((it) => (it.id === items[i].id ? { ...it, status: "done" } : it)),
        );
      } catch (err) {
        setQueue((q) =>
          q.map((it) =>
            it.id === items[i].id
              ? { ...it, status: "error", error: (err as Error).message }
              : it,
          ),
        );
      }
    }

    setBusy(false);
    if (okCount > 0) {
      setSuccess(
        okCount === files.length
          ? "Wgrano wszystkie zdjęcia. Dziękujemy!"
          : `Wgrano ${okCount} z ${files.length} zdjęć — resztę spróbuj ponownie albo wyślij mailem.`,
      );
      setCaption("");
      await qc.invalidateQueries({ queryKey: ["event-photos"] });
    } else {
      setError("Nie udało się wgrać żadnego zdjęcia. Spróbuj ponownie albo wyślij mailem.");
    }
  };

  return (
    <AppShell peopleCount={family.data.people.length}>
      <article className="event-page">
        <header className="event-hero">
          <p className="event-hero__eyebrow">Spotkanie rodziny Potrykus</p>
          <h1>Zdjęcia</h1>
          <p className="event-hero__lead">
            Wgraj tutaj zdjęcia ze spotkania i podpisz, kto na nich jest —
            trafią do wspólnej galerii.
          </p>
        </header>

        <section className="event-section">
          <h2>Wgraj zdjęcia</h2>
          <p className="photo-instructions">
            <strong>Nie udaje się wgrać albo masz dużo zdjęć?</strong> Wyślij
            je mailem na{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Jeśli
            wszystkie nie zmieszczą się w jednej wiadomości, wyślij w dwóch
            e-mailach. Pytania? Grupa WhatsApp „Spotkanie rodziny Potrykus”
            albo zakładka „Zgłoś”.
          </p>

          <form
            className="change-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="form-grid">
              <label>
                Imię i nazwisko *
                <input
                  required
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  placeholder="Kto wgrywa?"
                />
              </label>
              <label>
                Kto jest na zdjęciu?
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Np. Anna i Marek Potrykus"
                />
              </label>
            </div>

            <label className="field-block">
              Zdjęcia (jpg/png, max {MAX_FILE_MB} MB każde)
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={(e) => uploadFiles(e.target.files)}
              />
            </label>

            {queue.length > 0 && (
              <ul className="photo-upload-list">
                {queue.map((it) => (
                  <li key={it.id}>
                    <span>{it.name}</span>
                    <span
                      className={
                        it.status === "error"
                          ? "is-error"
                          : it.status === "done"
                            ? "is-done"
                            : undefined
                      }
                    >
                      {it.status === "pending" && "w kolejce…"}
                      {it.status === "uploading" && "wgrywanie…"}
                      {it.status === "done" && "wgrano"}
                      {it.status === "error" && (it.error || "błąd")}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="banner-error" role="alert">
                {error}
              </p>
            )}
            {success && (
              <p className="banner-success" role="status">
                {success}
              </p>
            )}
          </form>
        </section>

        <section className="event-section">
          <h2>Galeria ({photos.length})</h2>
          {photos.length === 0 ? (
            <p className="empty-hint">
              Jeszcze nikt nie wgrał zdjęć. Bądź pierwszy!
            </p>
          ) : (
            <ul className="photo-gallery">
              {photos.map((p) => (
                <li key={p.id} className="photo-gallery__item">
                  <a
                    className="photo-gallery__thumb"
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.caption || p.uploaderName} loading="lazy" />
                  </a>
                  <div className="photo-gallery__meta">
                    {p.caption && (
                      <span className="photo-gallery__caption">
                        {p.caption}
                      </span>
                    )}
                    <span className="photo-gallery__by">
                      wgrał(a): {p.uploaderName}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </AppShell>
  );
}
