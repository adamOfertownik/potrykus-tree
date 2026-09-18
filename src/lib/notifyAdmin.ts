import { Resend } from "resend";
import type { ChangeSubmission } from "@/types/submissions";
import { KIND_LABELS } from "@/lib/submissionLabels";
import {
  buildSubmissionNotifyEmail,
  resolveNotifyConfig,
  type NotifyChannel,
} from "@/lib/notifyAdminEmail";

/**
 * Best-effort admin mail. Missing Resend/key or send errors must not
 * fail the zgłoszenie that was already stored.
 */
export async function notifyAdminOfSubmission(
  submission: ChangeSubmission,
  channel: NotifyChannel,
): Promise<void> {
  try {
    const config = resolveNotifyConfig(process.env);
    if (!config.apiKey) {
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
      origin: config.origin,
    });

    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send(
      {
        from: config.from,
        to: [config.to],
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
