import { createHash } from "node:crypto";
import { ContributorModel } from "@durgapandals/database";
import { generateOtp, type VerificationProvider } from "@durgapandals/auth";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export class OtpRateLimitError extends Error {}
export class OtpInvalidError extends Error {}

export async function requestOtp(identifier: string, provider: VerificationProvider) {
  const contributor = await ContributorModel.findOneAndUpdate(
    { identifier },
    { $setOnInsert: { identifier } },
    { upsert: true, new: true }
  );

  if (
    contributor.otpLastSentAt &&
    Date.now() - contributor.otpLastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    throw new OtpRateLimitError("Please wait before requesting another code");
  }

  const code = generateOtp();
  contributor.otpCodeHash = hashCode(code);
  contributor.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  contributor.otpAttempts = 0;
  contributor.otpLastSentAt = new Date();
  await contributor.save();

  await provider.send(identifier, code);
}

export async function confirmOtp(identifier: string, code: string): Promise<boolean> {
  const contributor = await ContributorModel.findOne({ identifier });
  if (!contributor || !contributor.otpCodeHash || !contributor.otpExpiresAt) {
    throw new OtpInvalidError("No verification in progress");
  }

  if (contributor.otpAttempts >= MAX_ATTEMPTS) {
    throw new OtpRateLimitError("Too many incorrect attempts, request a new code");
  }

  if (contributor.otpExpiresAt.getTime() < Date.now()) {
    throw new OtpInvalidError("Code expired");
  }

  const isValid = contributor.otpCodeHash === hashCode(code);
  if (!isValid) {
    contributor.otpAttempts += 1;
    await contributor.save();
    return false;
  }

  contributor.verifiedAt = new Date();
  contributor.otpCodeHash = undefined;
  contributor.otpExpiresAt = undefined;
  await contributor.save();
  return true;
}
