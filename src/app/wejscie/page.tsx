import { Suspense } from "react";
import { ViewPageClient } from "@/components/ViewPageClient";

export default function ViewPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Ładowanie…</div>}>
      <ViewPageClient />
    </Suspense>
  );
}
