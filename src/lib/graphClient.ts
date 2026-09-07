import type { FamilyPayload } from "@/types/family";
import type { GraphMutationInput } from "@/lib/familyMutations";
import { loadReporter } from "@/lib/reporter";

export type GraphMutateResponse = {
  family?: FamilyPayload;
  summary: string;
  applyWarning?: string;
  createdPersonId?: string;
  error?: string;
};

export async function postGraphMutation(
  input: GraphMutationInput,
): Promise<GraphMutateResponse> {
  const reporter = loadReporter();
  const res = await fetch("/api/family/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      reporterName: reporter?.name || "Edycja grafu",
      reporterPersonId: reporter?.personId,
    }),
  });
  const data = (await res.json()) as GraphMutateResponse;
  if (!res.ok) {
    throw new Error(data.error || "Błąd zapisu");
  }
  return data;
}
