"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const router = useRouter();
  const [identity, setIdentityState] = useState<ReporterIdentity | null>(null);
  const [ready, setReady] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    const saved = loadReporter();
    setIdentityState(saved);
    setReady(true);
    if (!saved?.name) setPromptOpen(true);
  }, []);

  useEffect(() => {
    if (!enabled || !ready || !people.length) return;
    if (identity?.name) {
      setPromptOpen(false);
      return;
    }
    setPromptOpen(true);
  }, [enabled, ready, people.length, identity?.name]);

  const applyIdentity = (next: ReporterIdentity) => {
    saveReporter(next);
    setIdentityState(next);
    setPromptOpen(false);

    const onTree = pathname === "/" || pathname.startsWith("/drzewo");
    if (onTree && next.personId) {
      router.replace(`/drzewo?root=${encodeURIComponent(next.personId)}`);
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
          onClose={() => {
            if (identity?.name) setPromptOpen(false);
          }}
          onIdentified={(name, personId) => {
            applyIdentity({ name, personId });
          }}
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
