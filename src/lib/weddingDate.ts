/** Pull a structured wedding date out of free-text notes (`ślub 1881-02-27`). */
export function weddingDateFromNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const full = notes.match(/ślub\s+(\d{4}-\d{2}-\d{2})/i);
  if (full) return full[1];
  const yearMonth = notes.match(/ślub\s+(\d{4}-\d{2})(?!\d)/i);
  if (yearMonth) return yearMonth[1];
  const year = notes.match(/ślub\s+(\d{4})(?!\d)/i);
  if (year) return year[1];
  return undefined;
}

export function resolveWeddingDate(person: {
  weddingDate?: string;
  notes?: string;
}): string | undefined {
  const stored = person.weddingDate?.trim();
  if (stored) return stored;
  return weddingDateFromNotes(person.notes);
}
