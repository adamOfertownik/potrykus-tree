"use client";

import {
  createContext,
  useContext,
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
  const [identity, setIdentityState] = useState<ReporterIdentity | null>(
    () => loadReporter(),
  );
  const [askAgain, setAskAgain] = useState(false);
  const promptOpen = Boolean(
    enabled && people.length && (askAgain || !identity?.name),
  );

  const applyIdentity = (next: ReporterIdentity) => {
    saveReporter(next);
    setIdentityState(next);
    setAskAgain(false);

    const onTree = pathname === "/" || pathname.startsWith("/drzewo");
    if (onTree && next.personId) {
      router.replace(`/drzewo?root=${encodeURIComponent(next.personId)}`);
    }
  };

  const clearIdentity = () => {
    clearReporter();
    setIdentityState(null);
    setAskAgain(true);
  };

  const promptIdentity = () => setAskAgain(true);

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
            if (identity?.name) setAskAgain(false);
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
