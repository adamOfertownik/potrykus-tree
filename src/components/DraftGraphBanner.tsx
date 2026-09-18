"use client";

import { useState } from "react";
import { useOptionalDraftGraph } from "@/components/DraftGraphProvider";

export function DraftGraphBanner() {
  const draft = useOptionalDraftGraph();
  const [notice, setNotice] = useState<string | null>(null);
  if (!draft || draft.edits.length === 0) {
    if (!notice) return null;
    return (
      <p className="draft-graph-bar draft-graph-bar--done" role="status">
        {notice}
      </p>
    );
  }

  const people = draft.edits.filter((e) => e.newPerson).length;
  const label =
    people === 1
      ? "1 robocza osoba"
      : `${people || draft.edits.length} robocze osoby`;

  return (
    <div className="draft-graph-bar" data-testid="draft-graph-bar" role="status">
      <p>
        <strong>{label}</strong> na szaro — widać tylko u Ciebie.{" "}
        <strong>Admin jeszcze tego nie widzi</strong> — wyślij całość, żeby
        trafiło do zakładki Zgłoszenia.
      </p>
      <div className="draft-graph-bar__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={draft.submitting}
          onClick={async () => {
            try {
              const result = await draft.submitAll();
              setNotice(result.summary);
              window.setTimeout(() => setNotice(null), 7000);
            } catch {
              /* error shown below */
            }
          }}
        >
          {draft.submitting ? "Wysyłam…" : "Wyślij całość"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={draft.submitting}
          onClick={draft.discard}
        >
          Porzuć
        </button>
      </div>
      {draft.error && (
        <p className="draft-graph-bar__error" role="alert">
          {draft.error}
        </p>
      )}
    </div>
  );
}
