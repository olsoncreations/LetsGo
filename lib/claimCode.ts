import crypto from "crypto";

/**
 * Generate a short, unique claim code for seeded businesses.
 * Format: "LG-XXXXXXXX" (8 alphanumeric chars, uppercase)
 * Example: "LG-7K3M9PAB"
 */
export function generateClaimCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `LG-${code}`;
}
