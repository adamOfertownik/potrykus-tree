import { Suspense } from "react";
import { RegisterPageClient } from "@/components/RegisterPageClient";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="loading-screen">Ładowanie…</div>}>
      <RegisterPageClient />
    </Suspense>
  );
}
