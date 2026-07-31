"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useEffectEvent,
} from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@/types/family";
import {
  clearReporter,
  loadReporter,
  saveReporter,
  type ReporterIdentity,
} from "@/lib/reporter";
import { WhoAreYouDialog } from "@/components/WhoAreYouDialog";

type Ctx = {
  identity: ReporterIdentity | null;
  setIdentity: (id: ReporterIdentity) => void;
  clearIdentity: () => void;
  promptIdentity: () => void;
};

const IdentityContext = createContext<Ctx | null>(null);

export function IdentityProvider({
  people,
  enabled,
  children,
}: {
  people: Person[];
  enabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [identity, setIdentityState] = useState<ReporterIdentity | null>(null);
  const [ready, setReady] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const hydrate = useEffectEvent(() => {
    setIdentityState(loadReporter());
    setReady(true);
  });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!enabled || !ready || !people.length) return;
    if (identity?.name) return;
    setPromptOpen(true);
  }, [enabled, ready, people.length, identity?.name]);

  const setIdentity = (next: ReporterIdentity, opts?: { goToTree?: boolean }) => {
    saveReporter(next);
    setIdentityState(next);
    setPromptOpen(false);
    if (opts?.goToTree !== false && next.personId) {
      // Focus tree on “me” — same as searching yourself
      router.push(`/drzewo?root=${encodeURIComponent(next.personId)}`);
    }
  };

  const clearIdentity = () => {
    clearReporter();
    setIdentityState(null);
    setPromptOpen(true);
  };

  const promptIdentity = () => setPromptOpen(true);

  return (
    <IdentityContext.Provider
      value={{
        identity,
        setIdentity: (id) => setIdentity(id, { goToTree: false }),
        clearIdentity,
        promptIdentity,
      }}
    >
      {children}
      {enabled && (
        <WhoAreYouDialog
          people={people}
          open={promptOpen}
          compulsory={!identity?.name}
          onClose={() => {
            if (identity?.name) setPromptOpen(false);
          }}
          onIdentified={(name, personId) => {
            setIdentity({ name, personId }, { goToTree: true });
          }}
        />
      )}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) {
    return {
      identity: null as ReporterIdentity | null,
      setIdentity: (_: ReporterIdentity) => {},
      clearIdentity: () => {},
      promptIdentity: () => {},
    };
  }
  return ctx;
}
