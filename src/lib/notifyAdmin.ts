import { Resend } from "resend";
import type { ChangeSubmission } from "@/types/submissions";

const DEFAULT_TO = "adam199711@gmail.com";

function notifyTo(): string {
  return process.env.ADMIN_NOTIFY_EMAIL?.trim() || DEFAULT_TO;
}

function notifyFrom(): string {
  return (
    process.env.RESEND_FROM?.trim() ||
    "Drzewo Potrykus <onboarding@resend.dev>"
  );
}

export async function notifyAdminOfSubmission(
  submission: ChangeSubmission,
  kindLabel: "zgłoszenie" | "szkic",
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;

  const resend = new Resend(apiKey);
  const subject =
    kindLabel === "szkic"
      ? `[Szkic] ${submission.reporterName}: ${submission.message.slice(0, 80)}`
      : `[Zgłoszenie] ${submission.reporterName}: ${submission.message.slice(0, 80)}`;

  const text = [
    kindLabel === "szkic"
      ? "Ktoś edytuje drzewo, ale jeszcze nie kliknął „Wyślij do admina”."
      : "Nowe zgłoszenie czeka w panelu admina.",
    "",
    `Kto: ${submission.reporterName}`,
    submission.targetPersonName
      ? `Dotyczy: ${submission.targetPersonName}`
      : "",
    `Treść: ${submission.message}`,
    `Status: ${submission.status}`,
    `Czas: ${submission.createdAt}`,
    "",
    "Panel: /admin",
  ]
    .filter(Boolean)
    .join("\n");

  const { error } = await resend.emails.send(
    {
      from: notifyFrom(),
      to: [notifyTo()],
      subject,
      text,
    },
    {
      idempotencyKey: `potrykus-${kindLabel}-${submission.id}-${submission.status}`,
    },
  );

  if (error) {
    console.error("Nie udało się wysłać maila o zgłoszeniu.");
  }
}
