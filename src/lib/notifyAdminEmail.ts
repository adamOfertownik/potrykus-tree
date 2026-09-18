export type NotifyChannel = "zgłoszenie" | "szkic";

export const DEFAULT_NOTIFY_TO = "adam199711@gmail.com";
export const DEFAULT_NOTIFY_FROM = "Drzewo Potrykus <onboarding@resend.dev>";
export const DEFAULT_ORIGIN = "https://potrykus.vercel.app";

export function resolveNotifyConfig(env: Record<string, string | undefined>): {
  apiKey: string | null;
  to: string;
  from: string;
  origin: string;
} {
  const apiKey = env.RESEND_API_KEY?.trim() || null;
  const explicitOrigin =
    env.APP_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim();
  const vercelHost =
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || env.VERCEL_URL?.trim();
  const origin = explicitOrigin
    ? explicitOrigin.replace(/\/$/, "")
    : vercelHost
      ? `https://${vercelHost.replace(/^https?:\/\//, "")}`
      : DEFAULT_ORIGIN;
  return {
    apiKey,
    to:
      env.NOTIFY_EMAIL?.trim() ||
      env.ADMIN_NOTIFY_EMAIL?.trim() ||
      DEFAULT_NOTIFY_TO,
    from:
      env.EMAIL_FROM?.trim() ||
      env.RESEND_FROM?.trim() ||
      DEFAULT_NOTIFY_FROM,
    origin,
  };
}

export type SubmissionNotifyInput = {
  channel: NotifyChannel;
  id: string;
  reporterName: string;
  kindLabel: string;
  message: string;
  targetPersonName?: string;
  origin: string;
};

export type SubmissionNotifyEmail = {
  subject: string;
  text: string;
  html: string;
};

const SNIPPET_MAX = 280;

export function messageSnippet(text: string, max = SNIPPET_MAX): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function originBase(origin: string): string {
  return origin.replace(/\/$/, "") || "https://potrykus.vercel.app";
}

export function adminUrls(origin: string): { adminUrl: string; loginUrl: string } {
  const base = originBase(origin);
  return {
    adminUrl: `${base}/admin`,
    loginUrl: `${base}/login`,
  };
}

export function buildSubmissionNotifyEmail(
  input: SubmissionNotifyInput,
): SubmissionNotifyEmail {
  const reporter = input.reporterName.trim() || "Nieznany";
  const kind = input.kindLabel.trim() || "Inne";
  const snippet = messageSnippet(input.message);
  const target = input.targetPersonName?.trim();
  const { adminUrl, loginUrl } = adminUrls(input.origin);
  const isSketch = input.channel === "szkic";

  const subject = isSketch
    ? `Nowy szkic zgłoszenia: ${kind} — ${reporter}`
    : `Nowe zgłoszenie: ${kind} — ${reporter}`;

  const details = [
    `Zgłaszający: ${reporter}`,
    `Rodzaj: ${kind}`,
    ...(target ? [`Osoba, której dotyczy: ${target}`] : []),
    snippet ? `Treść: ${snippet}` : "Treść: (brak)",
    `Identyfikator zgłoszenia: ${input.id}`,
  ];

  const intro = isSketch
    ? "Nowy szkic zgłoszenia w drzewie rodziny Potrykus (jeszcze nie wysłane do kolejki)."
    : "Nowe zgłoszenie w drzewie rodziny Potrykus.";

  const text = [
    intro,
    "",
    ...details,
    "",
    `Panel admina: ${adminUrl}`,
    `Logowanie admina: ${loginUrl}`,
  ].join("\n");

  const rows: Array<[string, string]> = [
    ["Zgłaszający", reporter],
    ["Rodzaj", kind],
    ...(target ? ([["Osoba, której dotyczy", target]] as Array<[string, string]>) : []),
    ["Treść", snippet || "(brak)"],
    ["Identyfikator zgłoszenia", input.id],
  ];

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:4px 12px 4px 0;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</th><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const heading = isSketch ? "Nowy szkic zgłoszenia" : "Nowe zgłoszenie";
  const htmlIntro = isSketch
    ? "Ktoś edytuje drzewo, ale jeszcze nie kliknął „Wyślij do admina”."
    : "W drzewie rodziny Potrykus zapisano nowe zgłoszenie.";

  const html = `<!DOCTYPE html>
<html lang="pl">
<body style="font-family:system-ui,sans-serif;line-height:1.45;color:#111">
  <p><strong>${escapeHtml(heading)}</strong></p>
  <p>${escapeHtml(htmlIntro)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0">${htmlRows}</table>
  <p><a href="${escapeHtml(adminUrl)}">Otwórz panel admina</a><br>
  <a href="${escapeHtml(loginUrl)}">Logowanie admina</a></p>
</body>
</html>`;

  return { subject, text, html };
}
