// Company logos for the opportunities pack: small PNG or JPEG images (what the PDF can embed). Pure.

export const LOGO_TYPES = ["image/png", "image/jpeg"] as const;
export const MAX_LOGO_BYTES = 500 * 1024;

/** PNG or JPEG by its first bytes (never trust the browser's type), or null. */
export function sniffLogoType(bytes: Uint8Array): (typeof LOGO_TYPES)[number] | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}
