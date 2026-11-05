// Where the privacy notice, terms and privacy contact live. By default DXV OS's own public
// pages: /privacy (src/content/privacy-notice.ts, Kevin's signed-off notice) and /terms (the
// approved member terms). Set NEXT_PUBLIC_PRIVACY_NOTICE_URL / NEXT_PUBLIC_TERMS_URL only to
// point elsewhere (e.g. a copy on the website); NEXT_PUBLIC_PRIVACY_EMAIL for another contact.
// Pure: safe in client components.

export const PRIVACY_NOTICE_URL = process.env.NEXT_PUBLIC_PRIVACY_NOTICE_URL || "/privacy";
export const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL || "/terms";
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "angels@diversityx.vc";
/** Backups roll off within this many days (docs/privacy retention schedule; confirm with Supabase). */
export const BACKUP_DAYS = 30;
