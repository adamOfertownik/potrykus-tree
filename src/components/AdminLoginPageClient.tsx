"use client";

import { useSearchParams } from "next/navigation";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { useAdminAuthStatus } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminLoginPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAdminAuthStatus();
  const nextHref = searchParams.get("next") || "/admin";

  useEffect(() => {
    if (auth.data?.loggedIn) {
      const dest =
        auth.data.adminRole === "pay" && nextHref.startsWith("/admin")
          ? "/admin?tab=platnosci"
          : nextHref;
      router.replace(dest);
    }
  }, [auth.data?.loggedIn, auth.data?.adminRole, nextHref, router]);

  if (auth.isLoading || auth.data?.loggedIn) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return <AdminLoginForm nextHref={nextHref} />;
}
