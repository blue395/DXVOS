import { describe, expect, it } from "vitest";
import { deckPath } from "./deck-storage";

describe("deckPath", () => {
  it("namespaces by analysis id and sanitises the file name", () => {
    expect(deckPath("a1", "Kora Health (Final) v2.pdf")).toBe("a1/Kora-Health-Final-v2.pdf");
    expect(deckPath("a1", "../../etc/passwd")).toBe("a1/..-..-etc-passwd.pdf");
    expect(deckPath("a1", "deck.docx")).toBe("a1/deck.docx.pdf");
    expect(deckPath("a1", "")).toBe("a1/deck.pdf");
  });
});

describe("objectPath", () => {
  it("keeps the file's extension", async () => {
    const { objectPath } = await import("./deck-storage");
    expect(objectPath("d1", "Cap Table (v3).xlsx")).toBe("d1/Cap-Table-v3-.xlsx");
    expect(objectPath("d1", "notes")).toBe("d1/notes.pdf");
  });
});
