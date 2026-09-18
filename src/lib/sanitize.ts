const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAGS = /<\/?[^>]+>/g;

export function sanitizePlainText(value: string, max: number): string {
  return value
    .replace(TAGS, " ")
    .replace(CONTROL, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function sanitizeMultiline(value: string, max: number): string {
  return value
    .replace(TAGS, " ")
    .replace(CONTROL, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

export function sanitizePhone(value: string): string {
  const cleaned = value.replace(CONTROL, "").trim();
  const kept = cleaned.replace(/[^\d+()\-.\s]/g, "").replace(/\s+/g, " ").trim();
  return kept.slice(0, 40);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Optional address used only to confirm a submission. Empty → undefined. */
export function sanitizeConfirmEmail(
  value: string | undefined | null,
): string | undefined {
  if (!value) return undefined;
  const cleaned = sanitizePlainText(value, 254).toLowerCase();
  if (!cleaned) return undefined;
  if (!EMAIL_RE.test(cleaned)) return undefined;
  return cleaned;
}

const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

export function sanitizeDate(value: string): string | undefined {
  const trimmed = value.replace(CONTROL, "").trim();
  if (!trimmed) return undefined;
  return DATE_RE.test(trimmed) ? trimmed : undefined;
}

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isAllowedImageType(type: string): boolean {
  return ALLOWED_IMAGE_TYPES.has(type.toLowerCase());
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "photo";
}
