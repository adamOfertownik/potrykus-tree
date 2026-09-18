import { Suspense } from "react";
import { ListPageClient } from "@/components/ListPageClient";

export default function ListaPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Wczytywanie…</div>}>
      <ListPageClient />
    </Suspense>
  );
}
