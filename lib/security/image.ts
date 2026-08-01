const signatures = {
  "image/jpeg": (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes: Uint8Array) =>
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
  "image/webp": (bytes: Uint8Array) =>
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP",
} as const;

export type AllowedImageType = keyof typeof signatures;

export function hasValidImageSignature(bytes: Uint8Array, type: string): type is AllowedImageType {
  const validate = signatures[type as AllowedImageType];
  return Boolean(validate?.(bytes));
}
