"use client";

import { AuthedPage } from "@/components/AuthedPage";
import { ChangeRequestPanel } from "@/components/ChangeRequestPanel";

export function ZglosPageClient() {
  return (
    <AuthedPage>
      {({ people }) => <ChangeRequestPanel people={people} />}
    </AuthedPage>
  );
}
