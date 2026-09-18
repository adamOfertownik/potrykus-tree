import { Resend } from "resend";
import type { ChangeSubmission } from "@/types/submissions";
import { KIND_LABELS } from "@/lib/submissionLabels";
import {
  buildSubmissionNotifyEmail,
  type NotifyChannel,
} from "@/lib/notifyAdminEmail";

const DEFAULT_TO = "adam199711@gmail.com";
const DEFAULT_FROM = "Drzewo Potrykus <onboarding@resend.dev>";
const DEFAULT_ORIGIN = "https://potrykus.vercel.app";

function notifyTo(): string {
  return (
    process.env.NOTIFY_EMAIL?.trim() ||
    process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
    DEFAULT_TO
  );
}

function notifyFrom(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    DEFAULT_FROM
  );
}

export function appOrigin(): string {
  const explicit =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/^https?:\/\//, "")}`;
  }
  return DEFAULT_ORIGIN;
}

/**
 * Best-effort admin mail. Missing Resend/key or send errors must not
 * fail the zgłoszenie that was already stored.
 */
export async function notifyAdminOfSubmission(
  submission: ChangeSubmission,
  channel: NotifyChannel,
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn(
        "RESEND_API_KEY nie jest ustawiony — pomijam mail o zgłoszeniu.",
      );
      return;
    }

    const email = buildSubmissionNotifyEmail({
      channel,
      id: submission.id,
      reporterName: submission.reporterName,
      kindLabel: KIND_LABELS[submission.kind] ?? submission.kind,
      message: submission.message,
      targetPersonName: submission.targetPersonName,
      origin: appOrigin(),
    });

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send(
      {
        from: notifyFrom(),
        to: [notifyTo()],
        subject: email.subject,
        text: email.text,
        html: email.html,
      },
      {
        idempotencyKey: `potrykus-${channel}-${submission.id}-${submission.status}`,
      },
    );

    if (error) {
      console.warn(
        `Nie udało się wysłać maila o zgłoszeniu (${error.message}).`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "nieznany błąd";
    console.warn(`Nie udało się wysłać maila o zgłoszeniu (${message}).`);
  }
}
