// Where the privacy notice, terms and privacy contact live. PLACEHOLDERS until Blue publishes
// the notice (docs/privacy: "Publish at a public URL"): set NEXT_PUBLIC_PRIVACY_NOTICE_URL,
// NEXT_PUBLIC_TERMS_URL and NEXT_PUBLIC_PRIVACY_EMAIL in Netlify, then redeploy.
// Pure: safe in client components.

export const PRIVACY_NOTICE_URL = process.env.NEXT_PUBLIC_PRIVACY_NOTICE_URL || "https://www.diversityxventures.com/privacy-notice";
export const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL || "https://www.diversityxventures.com/terms";
export const PRIVACY_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "angels@diversityx.vc";
/** Backups roll off within this many days (docs/privacy retention schedule; confirm with Supabase). */
export const BACKUP_DAYS = 30;
