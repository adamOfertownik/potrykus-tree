"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FamilyPayload, Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { removePersonPhoto, uploadPersonPhoto } from "@/lib/upload-photo";

type Size = "sm" | "md" | "lg";
type Mode = "display" | "suggest" | "admin";

type Props = {
  person: Person;
  size?: Size;
  className?: string;
  mode?: Mode;
  onFamily?: (family: FamilyPayload) => void;
};

export function PersonPhotoControl({
  person,
  size = "md",
  className = "",
  mode = "display",
  onFamily,
}: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const name = displayName(person);
  const hasPhotoUrl = Boolean(person.photoUrl);
  const showPhoto = hasPhotoUrl && !broken;
  const editable = mode !== "display";

  useEffect(() => {
    setBroken(false);
  }, [person.photoUrl]);

  const applyFamily = async (family?: FamilyPayload) => {
    if (family) {
      qc.setQueryData(["family"], family);
      onFamily?.(family);
    } else if (mode === "admin") await qc.invalidateQueries({ queryKey: ["family"] });
  };

  const pick = () => {
    if (busy || !editable) return;
    inputRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await uploadPersonPhoto(file, person.id);
      await applyFamily(data.family);
      setBroken(false);
      if (!data.applied) {
        setNotice(
          "Zdjęcie wysłane jako sugestia. Admin musi je zaakceptować.",
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onRemove = async () => {
    if (busy || !person.photoUrl) return;
    if (mode === "admin") {
      const ok = window.confirm(`Usunąć zdjęcie: ${name}?`);
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await removePersonPhoto(person.id);
      await applyFamily(data.family);
      if (data.applied) setBroken(true);
      else setNotice("Prośba o usunięcie zdjęcia czeka na admina.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const media = showPhoto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.photoUrl} alt="" onError={() => setBroken(true)} />
  ) : (
    <span
      className={`person-card__silhouette${size === "lg" ? " large" : ""}`}
      aria-hidden
    />
  );

  return (
    <div className={`person-photo person-photo--${size} ${className}`.trim()}>
      {editable ? (
        <button
          type="button"
          className="person-photo__hit"
          aria-label={showPhoto ? `Zmień zdjęcie: ${name}` : `Dodaj zdjęcie: ${name}`}
          aria-busy={busy}
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            pick();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {media}
          <span className="person-photo__plus" aria-hidden>
            {busy ? "…" : "+"}
          </span>
        </button>
      ) : (
        <div className="person-photo__hit person-photo__hit--static">{media}</div>
      )}
      {editable && hasPhotoUrl ? (
        <button
          type="button"
          className="person-photo__remove"
          aria-label={`Usuń zdjęcie: ${name}`}
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void onRemove();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          ×
        </button>
      ) : null}
      {editable ? (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      ) : null}
      {notice ? (
        <p className="person-photo__error" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="person-photo__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
