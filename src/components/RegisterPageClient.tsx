"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RegisterGate } from "@/components/RegisterGate";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useAuthStatus, useFamily } from "@/lib/hooks";

export function RegisterPageClient() {
  const router = useRouter();
  const auth = useAuthStatus();
  const [justRegistered, setJustRegistered] = useState(false);
  const family = useFamily(justRegistered);

  useEffect(() => {
    if (auth.data?.unlocked && !justRegistered) router.replace("/drzewo");
  }, [auth.data?.unlocked, justRegistered, router]);

  if (justRegistered) {
    if (family.isLoading || !family.data) {
      return <div className="loading-screen">Ładowanie…</div>;
    }
    return (
      <OnboardingWizard
        people={family.data.people}
        isAdmin={auth.data?.role === "admin"}
        onFinish={() => router.replace("/drzewo")}
      />
    );
  }

  if (auth.isLoading || auth.data?.unlocked) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return <RegisterGate onRegistered={() => setJustRegistered(true)} />;
}
