import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_NOTIFY_FROM,
  DEFAULT_NOTIFY_TO,
  adminUrls,
  buildSubmissionNotifyEmail,
  escapeHtml,
  messageSnippet,
  resolveNotifyConfig,
} from "./notifyAdminEmail.ts";

const sample = {
  channel: "zgłoszenie" as const,
  id: "sub-abc-123",
  reporterName: "Jan Kowalski",
  kindLabel: "Poprawka danych",
  message: "Proszę poprawić datę urodzenia.",
  targetPersonName: "Anna Nowak",
  origin: "https://potrykus.vercel.app",
};

test("subject and body label a new zgłoszenie with reporter, kind, snippet, target, id", () => {
  const email = buildSubmissionNotifyEmail(sample);

  assert.match(email.subject, /Nowe zgłoszenie/);
  assert.match(email.subject, /Poprawka danych/);
  assert.match(email.subject, /Jan Kowalski/);

  assert.match(email.text, /Zgłaszający: Jan Kowalski/);
  assert.match(email.text, /Rodzaj: Poprawka danych/);
  assert.match(email.text, /Osoba, której dotyczy: Anna Nowak/);
  assert.match(email.text, /Treść: Proszę poprawić datę urodzenia\./);
  assert.match(email.text, /Identyfikator zgłoszenia: sub-abc-123/);
  assert.match(email.text, /https:\/\/potrykus\.vercel\.app\/admin/);
  assert.match(email.text, /https:\/\/potrykus\.vercel\.app\/login/);

  assert.match(email.html, /Nowe zgłoszenie/);
  assert.match(email.html, /Jan Kowalski/);
  assert.match(email.html, /href="https:\/\/potrykus\.vercel\.app\/admin"/);
});

test("omits target person line when none is provided", () => {
  const email = buildSubmissionNotifyEmail({
    ...sample,
    targetPersonName: undefined,
  });
  assert.equal(email.text.includes("Osoba, której dotyczy"), false);
  assert.equal(email.html.includes("Osoba, której dotyczy"), false);
});

test("sketch channel uses szkic wording", () => {
  const email = buildSubmissionNotifyEmail({
    ...sample,
    channel: "szkic",
  });
  assert.match(email.subject, /szkic/i);
  assert.match(email.text, /szkic/i);
});

test("messageSnippet truncates long text", () => {
  const long = "a".repeat(400);
  const cut = messageSnippet(long, 50);
  assert.equal(cut.endsWith("…"), true);
  assert.ok(cut.length <= 50);
});

test("escapeHtml encodes markup in the HTML body", () => {
  const email = buildSubmissionNotifyEmail({
    ...sample,
    reporterName: `<img src=x onerror=alert(1)>`,
    message: `Uwaga <script>alert("xss")</script>`,
  });
  assert.equal(email.html.includes("<script>"), false);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.html, /&lt;img/);
  assert.equal(escapeHtml("<b>"), "&lt;b&gt;");
});

test("adminUrls point at /admin and /login", () => {
  const urls = adminUrls("https://potrykus.vercel.app/");
  assert.equal(urls.adminUrl, "https://potrykus.vercel.app/admin");
  assert.equal(urls.loginUrl, "https://potrykus.vercel.app/login");
});

test("missing RESEND_API_KEY skips send but keeps default recipient", () => {
  const config = resolveNotifyConfig({});
  assert.equal(config.apiKey, null);
  assert.equal(config.to, DEFAULT_NOTIFY_TO);
  assert.equal(config.from, DEFAULT_NOTIFY_FROM);
});

test("NOTIFY_EMAIL and EMAIL_FROM win over aliases", () => {
  const config = resolveNotifyConfig({
    RESEND_API_KEY: " re_test ",
    NOTIFY_EMAIL: "new@example.com",
    ADMIN_NOTIFY_EMAIL: "old@example.com",
    EMAIL_FROM: "Potrykus <mail@potrykus.app>",
    RESEND_FROM: "Old <old@potrykus.app>",
  });
  assert.equal(config.apiKey, "re_test");
  assert.equal(config.to, "new@example.com");
  assert.equal(config.from, "Potrykus <mail@potrykus.app>");
});

test("legacy ADMIN_NOTIFY_EMAIL and RESEND_FROM still work", () => {
  const config = resolveNotifyConfig({
    RESEND_API_KEY: "re_legacy",
    ADMIN_NOTIFY_EMAIL: "adam199711@gmail.com",
    RESEND_FROM: "Drzewo <from@example.com>",
  });
  assert.equal(config.to, "adam199711@gmail.com");
  assert.equal(config.from, "Drzewo <from@example.com>");
});

test("origin falls back to potrykus.vercel.app, then Vercel host", () => {
  assert.equal(
    resolveNotifyConfig({}).origin,
    "https://potrykus.vercel.app",
  );
  assert.equal(
    resolveNotifyConfig({ VERCEL_URL: "potrykus-git-preview.vercel.app" }).origin,
    "https://potrykus-git-preview.vercel.app",
  );
});
