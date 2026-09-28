import type { ConnectionOptions } from "node:tls";

// TLS settings for the Postgres connection (pure, so it can be unit-tested).
//
// - Local database (localhost): no TLS, as in dev.
// - Remote database (e.g. Supabase): always encrypted. Supabase signs its server
//   certificates with its own CA, so to also VERIFY the server we need that CA —
//   supplied via DATABASE_CA_CERT (download from Supabase → Database settings → SSL).
//   Without it we still encrypt, but can't verify who we're talking to.
export function sslOptions(connectionString: string | undefined, caCert: string | undefined): ConnectionOptions | undefined {
  if (!connectionString) return undefined;

  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    return undefined;
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return undefined;

  const ca = caCert?.trim().replace(/\\n/g, "\n"); // accept a pasted PEM with literal "\n"s
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}
