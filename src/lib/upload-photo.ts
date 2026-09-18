"use client";

import { loadReporter } from "@/lib/reporter";
import type { FamilyPayload } from "@/types/family";

export type PhotoUploadResult = {
  ok: true;
  url: string;
  applied?: boolean;
  pending?: boolean;
  family?: FamilyPayload;
};

export type PhotoDeleteResult = {
  ok: true;
  applied?: boolean;
  pending?: boolean;
  family?: FamilyPayload;
};

export async function uploadPersonPhoto(
  file: File,
  personId?: string,
  opts?: { skipSubmission?: boolean; reporterEmail?: string },
): Promise<PhotoUploadResult> {
  const body = new FormData();
  body.append("file", file);
  if (personId) body.append("personId", personId);
  if (opts?.skipSubmission) body.append("skipSubmission", "1");
  const reporter = loadReporter();
  if (reporter?.name) body.append("reporterName", reporter.name);
  if (reporter?.personId) body.append("reporterPersonId", reporter.personId);
  if (opts?.reporterEmail) body.append("reporterEmail", opts.reporterEmail);

  const res = await fetch("/api/photos/upload", {
    method: "POST",
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Nie udało się wgrać zdjęcia.");
  }
  return data as PhotoUploadResult;
}

export async function removePersonPhoto(
  personId: string,
  opts?: { reporterEmail?: string },
): Promise<PhotoDeleteResult> {
  const reporter = loadReporter();
  const params = new URLSearchParams({ personId });
  if (reporter?.name) params.set("reporterName", reporter.name);
  if (reporter?.personId) params.set("reporterPersonId", reporter.personId);
  if (opts?.reporterEmail) params.set("reporterEmail", opts.reporterEmail);

  const res = await fetch(`/api/photos/upload?${params.toString()}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Nie udało się usunąć zdjęcia.");
  }
  return data as PhotoDeleteResult;
}
