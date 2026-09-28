import { describe, expect, it } from "vitest";
import { checkUpload, fileKind, formatFileSize, MAX_DOCUMENT_BYTES } from "./documents";

describe("checkUpload", () => {
  it("accepts PDF, Word and Excel, case-insensitively", () => {
    expect(checkUpload("Deck.PDF", 1000)).toEqual({ mimeType: "application/pdf" });
    expect(checkUpload("memo.docx", 1000)).toEqual({ mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    expect(checkUpload("model.xls", 1000)).toEqual({ mimeType: "application/vnd.ms-excel" });
  });

  it("rejects other types, empty files and files over 50 MB", () => {
    expect(checkUpload("photo.png", 1000)).toHaveProperty("error");
    expect(checkUpload("no-extension", 1000)).toHaveProperty("error");
    expect(checkUpload("a.pdf", 0)).toEqual({ error: "That file is empty." });
    expect(checkUpload("a.pdf", MAX_DOCUMENT_BYTES + 1)).toEqual({ error: "Files must be 50 MB or smaller." });
  });
});

describe("formatting", () => {
  it("formats sizes and file kinds", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(3.5 * 1024 * 1024)).toBe("3.5 MB");
    expect(fileKind("application/msword")).toBe("Word");
    expect(fileKind("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("Excel");
  });
});
