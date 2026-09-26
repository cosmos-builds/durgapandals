// Contributor OTP is provider-agnostic on purpose (spec §15): controllers and
// components only ever see this interface, never Resend/Twilio-specific
// calls, so swapping providers later touches one file.
export interface VerificationProvider {
  send(identifier: string, code: string): Promise<void>;
}

export interface CodeStore {
  save(identifier: string, code: string, expiresAt: Date): Promise<void>;
  verify(identifier: string, code: string): Promise<boolean>;
  attemptsRemaining(identifier: string): Promise<number>;
  registerAttempt(identifier: string): Promise<void>;
  canResend(identifier: string): Promise<boolean>;
}

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
