import { SignJWT } from "jose";

/** Test-only secret. Playwright injects the same value into `next start`. */
export const E2E_SESSION_SECRET = "potrykus-e2e-session-secret";
export const E2E_COOKIE_NAME = "potrykus_family_session";

export async function sessionCookie(role: "member" | "admin" = "member") {
  const token = await new SignJWT({
    role,
    userId: role === "admin" ? "e2e-admin" : "e2e-member",
    email: role === "admin" ? "admin@example.com" : "member@example.com",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(E2E_SESSION_SECRET));
  return {
    name: E2E_COOKIE_NAME,
    value: token,
    url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3333",
  };
}
