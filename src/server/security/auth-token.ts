import crypto from "node:crypto";

export class AuthTokenVerifier {
  constructor(private readonly expectedToken: string) {}

  verify(provided: string | undefined): boolean {
    if (!provided) return false;
    const expected = Buffer.from(this.expectedToken);
    const actual = Buffer.from(provided);
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  }
}

export function createPairingToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}
