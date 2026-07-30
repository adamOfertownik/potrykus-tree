"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useEffectEvent,
} from "react";
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

  const setIdentity = (next: ReporterIdentity) => {
    saveReporter(next);
    setIdentityState(next);
    setPromptOpen(false);
  };

  const clearIdentity = () => {
    clearReporter();
    setIdentityState(null);
    setPromptOpen(true);
  };

  const promptIdentity = () => setPromptOpen(true);

  return (
    <IdentityContext.Provider
      value={{ identity, setIdentity, clearIdentity, promptIdentity }}
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
            setIdentity({ name, personId });
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
