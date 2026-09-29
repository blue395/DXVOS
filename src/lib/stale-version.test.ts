import { describe, expect, it } from "vitest";
import { actionErrorMessage, isStaleActionError, STALE_VERSION_MESSAGE } from "./stale-version";

describe("stale version detection", () => {
  it("recognises Next.js's missing server action error", () => {
    const e = new Error(
      'Server Action "4061a10b85c269e25d2e2dbfcf35449254341860b8" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action',
    );
    expect(isStaleActionError(e)).toBe(true);
    expect(actionErrorMessage(e)).toBe(STALE_VERSION_MESSAGE);
  });

  it("leaves other errors alone", () => {
    expect(isStaleActionError(new Error("Upload failed (500)"))).toBe(false);
    expect(actionErrorMessage(new Error("Upload failed (500)"))).toBe("Upload failed (500)");
    expect(actionErrorMessage("nope", "Upload failed.")).toBe("Upload failed.");
  });
});
