import { Suspense } from "react";
import { TreePageClient } from "@/components/TreePageClient";

export default function DrzewoPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Ładowanie…</div>}>
      <TreePageClient />
    </Suspense>
  );
}
