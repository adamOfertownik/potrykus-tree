import { Suspense } from "react";
import { AdminPageClient } from "@/components/AdminPageClient";

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Ładowanie…</div>}>
      <AdminPageClient />
    </Suspense>
  );
}
