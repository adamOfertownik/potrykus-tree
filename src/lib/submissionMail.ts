import type { ChangeSubmission, FieldDiff, GraphEditPayload, PersonFieldPatch } from "@/types/submissions";
import {
  GRAPH_OP_LABELS,
  KIND_LABELS,
  PERSON_FIELD_LABELS,
  genderLabel,
} from "@/lib/submissionLabels";

const SITE = "https://potrykus.vercel.app";

function submissionGraphEdits(
  submission: Pick<ChangeSubmission, "graphEdit" | "graphEdits">,
): GraphEditPayload[] {
  if (submission.graphEdits?.length) return submission.graphEdits;
  return submission.graphEdit ? [submission.graphEdit] : [];
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  });
}

function formatFieldValue(field: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (field === "gender" && typeof value === "string") return genderLabel(value);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

function correctionDiffs(submission: ChangeSubmission): FieldDiff[] {
  const patch = submission.correction as PersonFieldPatch | undefined;
  if (!patch) return [];
  const before = submission.before?.[0];
  const diffs: FieldDiff[] = [];
  for (const [field, after] of Object.entries(patch) as [
    keyof PersonFieldPatch,
    string | undefined,
  ][]) {
    if (after === undefined) continue;
    const beforeVal = before
      ? before[field as keyof typeof before]
      : undefined;
    const beforeText = formatFieldValue(field, beforeVal);
    const afterText = formatFieldValue(field, after);
    if (beforeText === afterText) continue;
    diffs.push({
      field,
      label: PERSON_FIELD_LABELS[field] || field,
      before: beforeText,
      after: afterText,
    });
  }
  return diffs;
}

export type MailChangeRow = {
  label: string;
  before?: string;
  after: string;
};

export function submissionChangeRows(submission: ChangeSubmission): MailChangeRow[] {
  const rows: MailChangeRow[] = [];
  for (const diff of correctionDiffs(submission)) {
    rows.push({
      label: diff.label,
      before: diff.before,
      after: diff.after,
    });
  }
  for (const edit of submissionGraphEdits(submission)) {
    const who = edit.newPerson
      ? `${edit.newPerson.firstName} ${edit.newPerson.lastName}`.trim()
      : "";
    rows.push({
      label: GRAPH_OP_LABELS[edit.op] || edit.op,
      after: edit.summary?.trim() || who || "Zmiana w drzewie",
    });
  }
  if (submission.kind === "photo") {
    rows.push({
      label: "Zdjęcie",
      before: submission.photoAction === "remove" ? "jest" : "—",
      after:
        submission.photoAction === "remove"
          ? "usunąć"
          : "nowe zdjęcie do akceptacji",
    });
  }
  if (submission.self) {
    const maiden = submission.self.maidenName
      ? ` (z d. ${submission.self.maidenName})`
      : "";
    rows.push({
      label: "Nowa osoba",
      after: `${submission.self.firstName} ${submission.self.lastName}${maiden}`,
    });
  }
  for (const rel of submission.relatives ?? []) {
    if (!rel.firstName?.trim()) continue;
    rows.push({
      label: rel.relation || "Bliski",
      after: `${rel.firstName} ${rel.lastName}`.trim(),
    });
  }
  return rows;
}

function rowsTableHtml(rows: MailChangeRow[]): string {
  if (!rows.length) return "";
  const body = rows
    .map((row) => {
      const hasBefore = row.before != null && row.before !== "";
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e3ebe4;color:#3d5a4c;font-size:14px;vertical-align:top;">${escapeHtml(row.label)}</td>
        ${
          hasBefore
            ? `<td style="padding:10px 12px;border-bottom:1px solid #e3ebe4;color:#6a7f72;font-size:14px;vertical-align:top;">${escapeHtml(row.before || "—")}</td>`
            : ""
        }
        <td style="padding:10px 12px;border-bottom:1px solid #e3ebe4;color:#1a2e24;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(row.after)}</td>
      </tr>`;
    })
    .join("");
  const hasBefore = rows.some((row) => row.before != null && row.before !== "");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0 4px;background:#f7faf7;border:1px solid #d5e4d8;border-radius:12px;overflow:hidden;">
    <thead>
      <tr style="background:#0f6b5c;color:#ffffff;">
        <th align="left" style="padding:10px 12px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;font-weight:600;">Pole</th>
        ${
          hasBefore
            ? `<th align="left" style="padding:10px 12px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;font-weight:600;">Teraz</th>`
            : ""
        }
        <th align="left" style="padding:10px 12px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;font-weight:600;">Propozycja</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>`;
}

function wrapHtml(opts: {
  kicker: string;
  title: string;
  intro: string;
  submission: ChangeSubmission;
  footer: string;
  extra?: string;
}): string {
  const rows = submissionChangeRows(opts.submission);
  const message = opts.submission.message?.trim();
  const target = opts.submission.targetPersonName?.trim();
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#e7efe8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e7efe8;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="font-family:Georgia,'Iowan Old Style',Palatino,serif;color:#3d5a4c;font-size:13px;padding:0 8px 12px;">
              Drzewo rodziny Potrykus
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #b7c9bc;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#0f6b5c;padding:28px 32px;color:#ffffff;font-family:Georgia,'Iowan Old Style',Palatino,serif;">
                    <p style="margin:0;font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.88;">${escapeHtml(opts.kicker)}</p>
                    <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;font-weight:normal;">${escapeHtml(opts.title)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 32px 8px;font-family:'Segoe UI',system-ui,sans-serif;color:#1a2e24;font-size:16px;line-height:1.55;">
                    <p style="margin:0 0 16px;">${escapeHtml(opts.intro)}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
                      <tr>
                        <td style="padding:12px 14px;background:#f7faf7;border-radius:12px;border:1px solid #e3ebe4;">
                          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#3d5a4c;">Rodzaj</p>
                          <p style="margin:0;font-weight:650;">${escapeHtml(KIND_LABELS[opts.submission.kind] || opts.submission.kind)}</p>
                          ${
                            target
                              ? `<p style="margin:10px 0 0;font-size:14px;color:#3d5a4c;">Dotyczy: <strong style="color:#1a2e24;">${escapeHtml(target)}</strong></p>`
                              : ""
                          }
                          <p style="margin:8px 0 0;font-size:14px;color:#3d5a4c;">Zgłosił(a): <strong style="color:#1a2e24;">${escapeHtml(opts.submission.reporterName)}</strong></p>
                          <p style="margin:8px 0 0;font-size:13px;color:#6a7f72;">${escapeHtml(formatWhen(opts.submission.createdAt))}</p>
                        </td>
                      </tr>
                    </table>
                    ${
                      rows.length
                        ? `<p style="margin:0 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#3d5a4c;">Wprowadzone zmiany</p>${rowsTableHtml(rows)}`
                        : ""
                    }
                    ${
                      message
                        ? `<p style="margin:18px 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#3d5a4c;">Opis</p>
                           <p style="margin:0 0 8px;padding:14px 16px;background:#eef6f1;border-radius:12px;white-space:pre-wrap;">${escapeHtml(message)}</p>`
                        : ""
                    }
                    ${opts.extra || ""}
                    <p style="margin:22px 0 0;font-size:14px;color:#3d5a4c;line-height:1.5;">${escapeHtml(opts.footer)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 28px;font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;color:#6a7f72;">
                    Adres użyty wyłącznie do tej wiadomości — bez newslettera i bez zapisu na drzewie.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function rowsText(rows: MailChangeRow[]): string {
  if (!rows.length) return "";
  return [
    "Zmiany:",
    ...rows.map((row) =>
      row.before
        ? `• ${row.label}: ${row.before} → ${row.after}`
        : `• ${row.label}: ${row.after}`,
    ),
  ].join("\n");
}

export function submitterMailContent(submission: ChangeSubmission): {
  subject: string;
  html: string;
  text: string;
} {
  const rows = submissionChangeRows(submission);
  const subject = `Potwierdzenie: ${KIND_LABELS[submission.kind] || "zgłoszenie"} — Drzewo Potrykus`;
  const html = wrapHtml({
    kicker: "Potwierdzenie wysyłki",
    title: "Dostaliśmy Twoje zmiany",
    intro:
      "Dziękujemy. Poniżej kopia tego, co wysłałeś/aś do drzewa. Nic nie zmienia się od razu — admin najpierw to zobaczy i zaakceptuje albo dopyta.",
    submission,
    footer:
      "Ten mail jest tylko kopią zapasową, żeby zgłoszenie nie zaginęło. Adresu nie używamy do niczego innego.",
  });
  const text = [
    "Dostaliśmy Twoje zmiany w Drzewie Potrykus.",
    "",
    `Rodzaj: ${KIND_LABELS[submission.kind] || submission.kind}`,
    submission.targetPersonName
      ? `Dotyczy: ${submission.targetPersonName}`
      : "",
    `Kto: ${submission.reporterName}`,
    `Kiedy: ${formatWhen(submission.createdAt)}`,
    "",
    rowsText(rows),
    "",
    submission.message ? `Opis: ${submission.message}` : "",
    "",
    "Admin jeszcze musi to przyjąć. Ten adres jest tylko na potwierdzenie — bez newslettera i bez zapisu na drzewie.",
  ]
    .filter((line) => line !== "")
    .join("\n");
  return { subject, html, text };
}

export function adminMailContent(
  submission: ChangeSubmission,
  kindLabel: "zgłoszenie" | "szkic",
): { subject: string; html: string; text: string } {
  const rows = submissionChangeRows(submission);
  const isSketch = kindLabel === "szkic";
  const subject = isSketch
    ? `[Szkic] ${submission.reporterName}: ${submission.message.slice(0, 80)}`
    : `[Zgłoszenie] ${submission.reporterName}: ${submission.message.slice(0, 80)}`;
  const html = wrapHtml({
    kicker: isSketch ? "Szkic w panelu" : "Nowe zgłoszenie",
    title: isSketch
      ? "Ktoś edytuje drzewo, jeszcze bez „Wyślij”"
      : "Nowe zgłoszenie czeka w panelu",
    intro: isSketch
      ? "To szkic — osoba jeszcze nie kliknęła „Wyślij do admina”. Nie wgrywaj tego jako gotowej zmiany."
      : "Rodzina przysłała sugestię. Wejdź do panelu, zobacz podgląd i zaakceptuj albo odrzuć.",
    submission,
    extra: submission.reporterEmail
      ? `<p style="margin:16px 0 0;font-size:14px;color:#3d5a4c;">Potwierdzenie poszło też na <strong>${escapeHtml(submission.reporterEmail)}</strong> (tylko ta wysyłka).</p>`
      : "",
    footer: `Panel: ${SITE}/admin`,
  });
  const text = [
    isSketch
      ? "Ktoś edytuje drzewo, ale jeszcze nie kliknął „Wyślij do admina”."
      : "Nowe zgłoszenie czeka w panelu admina.",
    "",
    `Kto: ${submission.reporterName}`,
    submission.reporterEmail
      ? `Mail na potwierdzenie: ${submission.reporterEmail}`
      : "",
    submission.targetPersonName
      ? `Dotyczy: ${submission.targetPersonName}`
      : "",
    `Treść: ${submission.message}`,
    `Status: ${submission.status}`,
    `Czas: ${submission.createdAt}`,
    "",
    rowsText(rows),
    "",
    `Panel: ${SITE}/admin`,
  ]
    .filter((line) => line !== "")
    .join("\n");
  return { subject, html, text };
}
