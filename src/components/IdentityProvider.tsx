"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { resolveReporterIdentity } from "@/lib/resolvePerson";
import { useAuthStatus, useFamily } from "@/lib/hooks";
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

export function IdentityProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const people = family.data?.people ?? [];
  const enabled = Boolean(unlocked && family.data && !family.isLoading);

  const [identity, setIdentityState] = useState<ReporterIdentity | null>(() =>
    loadReporter(),
  );
  const [ready, setReady] = useState(() => typeof window !== "undefined");
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    const saved = loadReporter();
    if (saved) setIdentityState(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!people.length) return;
    setIdentityState((cur) => {
      const base = cur ?? loadReporter();
      if (!base) return cur;
      const resolved = resolveReporterIdentity(people, base);
      if (!resolved) return base;
      if (
        resolved.personId !== base.personId ||
        resolved.name !== base.name
      ) {
        saveReporter(resolved);
      }
      return resolved;
    });
  }, [people.length, family.dataUpdatedAt]);

  useEffect(() => {
    if (!enabled || !ready) return;
    if (identity?.name) {
      setPromptOpen(false);
      return;
    }
    setPromptOpen(true);
  }, [enabled, ready, identity?.name]);

  const applyIdentity = useCallback((next: ReporterIdentity) => {
    saveReporter(next);
    setIdentityState(next);
    setPromptOpen(false);
  }, []);

  const clearIdentity = useCallback(() => {
    clearReporter();
    setIdentityState(null);
    setPromptOpen(true);
  }, []);

  const promptIdentity = useCallback(() => setPromptOpen(true), []);

  const handleWhoClose = useCallback(() => {
    if (identity?.name) setPromptOpen(false);
  }, [identity?.name]);

  const handleIdentified = useCallback(
    (name: string, personId?: string) => {
      applyIdentity({ name, personId });
    },
    [applyIdentity],
  );

  return (
    <IdentityContext.Provider
      value={{
        identity,
        setIdentity: applyIdentity,
        clearIdentity,
        promptIdentity,
      }}
    >
      {children}
      {enabled && promptOpen ? (
        <WhoAreYouDialog
          people={people}
          open
          compulsory={!identity?.name}
          onClose={handleWhoClose}
          onIdentified={handleIdentified}
        />
      ) : null}
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
