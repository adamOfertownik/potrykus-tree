/** Max JWT + cookie lifetime when the family checks “remember me”. */
export const FAMILY_REMEMBER_MAX_AGE_SEC = 60 * 60 * 24 * 30;

/** Short family session (no remember) — also capped by idle logout. */
export const FAMILY_SHORT_MAX_AGE_SEC = 60 * 60 * 12;

/** Admin session max (re-login required afterward). */
export const ADMIN_MAX_AGE_SEC = 60 * 60 * 8;

/** Log out admin after this idle period. */
export const ADMIN_IDLE_MS = 30 * 60 * 1000;

/** Log out family (without remember) after this idle period. */
export const FAMILY_IDLE_MS = 4 * 60 * 60 * 1000;

/** Warn this long before idle logout. */
export const IDLE_WARN_MS = 2 * 60 * 1000;
