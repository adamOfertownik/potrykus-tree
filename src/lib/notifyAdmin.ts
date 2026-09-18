import { Resend } from "resend";
import type { ChangeSubmission } from "@/types/submissions";
import { adminMailContent, submitterMailContent } from "@/lib/submissionMail";

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

async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(
    {
      from: notifyFrom(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    },
    { idempotencyKey: opts.idempotencyKey },
  );

  if (error) {
    console.error("Nie udało się wysłać maila o zgłoszeniu.");
    return false;
  }
  return true;
}

export async function notifyAdminOfSubmission(
  submission: ChangeSubmission,
  kindLabel: "zgłoszenie" | "szkic",
): Promise<void> {
  const admin = adminMailContent(submission, kindLabel);
  await sendResend({
    to: notifyTo(),
    subject: admin.subject,
    html: admin.html,
    text: admin.text,
    idempotencyKey: `potrykus-${kindLabel}-${submission.id}-${submission.status}`,
  });
}

export async function notifySubmitterOfSubmission(
  submission: ChangeSubmission,
): Promise<boolean> {
  const to = submission.reporterEmail?.trim();
  if (!to) return false;
  const mail = submitterMailContent(submission);
  return sendResend({
    to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    idempotencyKey: `potrykus-confirm-${submission.id}`,
  });
}
