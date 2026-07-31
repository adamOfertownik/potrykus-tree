import { Suspense } from "react";
import { TreePageClient } from "@/components/TreePageClient";

/** Home is the tree — no redirect hop (redirect / → /drzewo broke first mobile visit). */
export default function HomePage() {
  return (
    <Suspense fallback={<div className="loading-screen">Ładowanie…</div>}>
      <TreePageClient />
    </Suspense>
  );
}
