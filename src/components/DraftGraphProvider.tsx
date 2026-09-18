"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyGraphMutations,
  overlayDraftPeople,
  type GraphMutationInput,
} from "@/lib/familyMutations";
import { loadReporter } from "@/lib/reporter";
import { withChildrenIds } from "@/lib/tree";
import type { Person, PersonPublic } from "@/types/family";

const STORAGE_KEY = "potrykus_draft_graph_v1";

export type DraftGraphEdit = GraphMutationInput & { summary: string };

type DraftGraphValue = {
  edits: DraftGraphEdit[];
  pendingCount: number;
  submitting: boolean;
  error: string | null;
  overlayPeople: (people: Person[]) => Person[];
  mergePeople: (people: Person[]) => PersonPublic[];
  stage: (
    input: GraphMutationInput,
    currentPeople: Person[],
  ) => {
    createdPersonId?: string;
    summary: string;
  };
  discard: () => void;
  submitAll: (opts?: { reporterEmail?: string }) => Promise<{ summary: string }>;
  submitIncluding: (
    input: GraphMutationInput,
    currentPeople: Person[],
    opts?: { reporterEmail?: string },
  ) => Promise<{ summary: string }>;
};

const DraftGraphContext = createContext<DraftGraphValue | null>(null);

function readStoredEdits(): DraftGraphEdit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { edits?: DraftGraphEdit[] };
    return Array.isArray(parsed.edits) ? parsed.edits : [];
  } catch {
    return [];
  }
}

function persistEdits(edits: DraftGraphEdit[]) {
  if (typeof window === "undefined") return;
  if (edits.length === 0) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ edits }));
}

function postSketch(edits: DraftGraphEdit[], discarded = false) {
  if (typeof window === "undefined") return;
  const reporter = loadReporter();
  void fetch("/api/family/sketch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      discarded,
      reporterName: reporter?.name || "Gość",
      reporterPersonId: reporter?.personId,
      message: edits.map((edit) => edit.summary).filter(Boolean).join("; "),
      edits: discarded
        ? []
        : edits.map(({ summary: _summary, ...edit }) => {
            void _summary;
            return edit;
          }),
    }),
  }).catch(() => {
    /* szkic jest dodatkiem — nie blokuje edycji */
  });
}

let draftSeq = 0;

export function nextDraftPersonId(): string {
  draftSeq += 1;
  return `draft-${Date.now().toString(36)}-${draftSeq}`;
}

export function DraftGraphProvider({ children }: { children: ReactNode }) {
  const [edits, setEdits] = useState<DraftGraphEdit[]>(readStoredEdits);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sketchTimer = useRef<number>(0);

  const replaceEdits = useCallback((next: DraftGraphEdit[]) => {
    setEdits(next);
    persistEdits(next);
    window.clearTimeout(sketchTimer.current);
    sketchTimer.current = window.setTimeout(() => {
      postSketch(next, next.length === 0);
    }, 1500);
  }, []);

  const overlayPeople = useCallback(
    (people: Person[]) => overlayDraftPeople(people, edits),
    [edits],
  );

  const mergePeople = useCallback(
    (people: Person[]) => withChildrenIds(overlayPeople(people)),
    [overlayPeople],
  );

  const stage = useCallback(
    (input: GraphMutationInput, currentPeople: Person[]) => {
      const preview = applyGraphMutations(
        {
          meta: {
            title: "",
            rootPersonId: input.anchorPersonId,
            creator: "",
            updatedAt: "",
            description: "",
          },
          people: currentPeople,
        },
        [input],
        { keepClientIds: true, markPending: true },
      );
      const next: DraftGraphEdit[] = [
        ...edits,
        { ...input, summary: preview.summary },
      ];
      replaceEdits(next);
      setError(null);
      return {
        createdPersonId: preview.createdPeople[0]?.id,
        summary: preview.summary,
      };
    },
    [edits, replaceEdits],
  );

  const discard = useCallback(() => {
    replaceEdits([]);
    setError(null);
  }, [replaceEdits]);

  const postEdits = useCallback(
    async (
      payload: GraphMutationInput[],
      reporterEmail?: string,
    ) => {
      const reporter = loadReporter();
      if (!reporter?.name?.trim()) {
        throw new Error(
          "Wybierz kim jesteś (przycisk Ja w menu) — admin musi wiedzieć, kto wysłał zgłoszenie.",
        );
      }
      const res = await fetch("/api/family/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edits: payload,
          reporterName: reporter.name,
          reporterPersonId: reporter.personId,
          reporterEmail: reporterEmail?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      return `${data.summary} Wysłano jako jedną sugestię — drzewo zmieni się po akceptacji admina.`;
    },
    [],
  );

  const submitAll = useCallback(
    async (opts?: { reporterEmail?: string }) => {
    if (edits.length === 0) return { summary: "" };
    setSubmitting(true);
    setError(null);
    try {
      const summary = await postEdits(
        edits.map(({ summary: _summary, ...edit }) => {
          void _summary;
          return edit;
        }),
        opts?.reporterEmail,
      );
      replaceEdits([]);
      return { summary };
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [edits, postEdits, replaceEdits]);

  const submitIncluding = useCallback(
    async (
      input: GraphMutationInput,
      currentPeople: Person[],
      opts?: { reporterEmail?: string },
    ) => {
      setSubmitting(true);
      setError(null);
      try {
        const preview = applyGraphMutations(
          {
            meta: {
              title: "",
              rootPersonId: input.anchorPersonId,
              creator: "",
              updatedAt: "",
              description: "",
            },
            people: currentPeople,
          },
          [input],
          { keepClientIds: true, markPending: true },
        );
        const summary = await postEdits(
          [
            ...edits.map(({ summary: _summary, ...edit }) => {
              void _summary;
              return edit;
            }),
            input,
          ],
          opts?.reporterEmail,
        );
        void preview.summary;
        replaceEdits([]);
        return { summary };
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [edits, postEdits, replaceEdits],
  );

  const value = useMemo<DraftGraphValue>(
    () => ({
      edits,
      pendingCount: edits.length,
      submitting,
      error,
      overlayPeople,
      mergePeople,
      stage,
      discard,
      submitAll,
      submitIncluding,
    }),
    [
      discard,
      edits,
      error,
      mergePeople,
      overlayPeople,
      stage,
      submitAll,
      submitIncluding,
      submitting,
    ],
  );

  return (
    <DraftGraphContext.Provider value={value}>
      {children}
    </DraftGraphContext.Provider>
  );
}

export function useDraftGraph(): DraftGraphValue {
  const ctx = useContext(DraftGraphContext);
  if (!ctx) {
    throw new Error("useDraftGraph wymaga DraftGraphProvider.");
  }
  return ctx;
}

export function useOptionalDraftGraph(): DraftGraphValue | null {
  return useContext(DraftGraphContext);
}
