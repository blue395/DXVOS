import { describe, expect, it } from "vitest";
import { sslOptions } from "./db-ssl";

describe("sslOptions", () => {
  it("uses no TLS for a local database", () => {
    expect(sslOptions("postgresql://dxv:dxv@localhost:5432/dxvos", undefined)).toBeUndefined();
  });

  it("encrypts remote connections even without a CA cert", () => {
    expect(sslOptions("postgresql://u:p@aws-0-eu-west-2.pooler.supabase.com:6543/postgres", undefined)).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("verifies the server when a CA cert is supplied", () => {
    const opts = sslOptions("postgresql://u:p@db.example.supabase.co:5432/postgres", "-----BEGIN CERTIFICATE-----\\nabc\\n-----END CERTIFICATE-----");
    expect(opts).toEqual({ ca: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----", rejectUnauthorized: true });
  });
});
