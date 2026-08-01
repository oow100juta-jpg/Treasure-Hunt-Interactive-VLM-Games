import { describe, expect, it } from "vitest";
import { hasValidImageSignature } from "../lib/security/image";

describe("image upload signatures", () => {
  it("accepts supported file signatures", () => {
    expect(hasValidImageSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
    expect(hasValidImageSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(hasValidImageSignature(new TextEncoder().encode("RIFF1234WEBP"), "image/webp")).toBe(true);
  });

  it("rejects spoofed MIME types and unsupported formats", () => {
    const executable = new TextEncoder().encode("#!/bin/sh");
    expect(hasValidImageSignature(executable, "image/jpeg")).toBe(false);
    expect(hasValidImageSignature(executable, "image/png")).toBe(false);
    expect(hasValidImageSignature(executable, "image/svg+xml")).toBe(false);
  });
});
