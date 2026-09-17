/** Bump when the family notices change — the gate asks again. */
export const LEGAL_VERSION = "1";
export const LEGAL_UPDATED_LABEL = "17 września 2026";
export const LEGAL_STORAGE_KEY = "potrykus_legal_accept";

export type LegalAcceptRecord = {
  version: string;
  at: string;
};

export function parseLegalAccept(raw: string | null): LegalAcceptRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LegalAcceptRecord;
    if (parsed?.version === LEGAL_VERSION && typeof parsed.at === "string") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}
