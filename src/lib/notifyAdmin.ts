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

function asciiIdempotencyKey(parts: string[]): string {
  return parts
    .join("-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l")
    .replace(/[^a-zA-Z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 256);
}

function resendErrorText(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const rec = error as {
    message?: string;
    name?: string;
    statusCode?: number;
  };
  return [rec.name, rec.statusCode, rec.message].filter(Boolean).join(" ");
}

async function sendResend(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  replyTo?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("Brak RESEND_API_KEY — mail o zgłoszeniu nie poszedł.");
    return false;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send(
    {
      from: notifyFrom(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    },
    { idempotencyKey: opts.idempotencyKey },
  );

  if (error) {
    console.error("Nie udało się wysłać maila o zgłoszeniu.", resendErrorText(error));
    return false;
  }
  return true;
}

export async function notifyAdminOfSubmission(
  submission: ChangeSubmission,
  kindLabel: "zgłoszenie" | "szkic",
): Promise<boolean> {
  const admin = adminMailContent(submission, kindLabel);
  const kindKey = kindLabel === "szkic" ? "sketch" : "submission";
  return sendResend({
    to: notifyTo(),
    subject: admin.subject,
    html: admin.html,
    text: admin.text,
    idempotencyKey: asciiIdempotencyKey([
      "potrykus",
      kindKey,
      submission.id,
      submission.status,
    ]),
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
    replyTo: notifyTo(),
    idempotencyKey: asciiIdempotencyKey(["potrykus", "confirm", submission.id]),
  });
}

/** Wait for both mails so a Vercel function does not freeze before Resend. */
export async function notifyMailsForSubmission(
  submission: ChangeSubmission,
  kindLabel: "zgłoszenie" | "szkic",
): Promise<void> {
  const jobs = [notifyAdminOfSubmission(submission, kindLabel)];
  if (kindLabel === "zgłoszenie" && submission.reporterEmail?.trim()) {
    jobs.push(notifySubmitterOfSubmission(submission));
  }
  await Promise.all(jobs);
}
