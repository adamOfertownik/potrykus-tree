import { Suspense } from "react";
import { AdminLoginPageClient } from "@/components/AdminLoginPageClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Ładowanie…</div>}>
      <AdminLoginPageClient />
    </Suspense>
  );
}
