import { Resend } from "resend";
import type { VerificationProvider } from "../verification-provider";

export interface ResendEmailProviderOptions {
  apiKey: string;
  fromAddress: string;
}

// The only file in the codebase that knows about Resend specifically.
export class ResendEmailProvider implements VerificationProvider {
  private options: ResendEmailProviderOptions;
  private client: Resend | undefined;

  constructor(options: ResendEmailProviderOptions) {
    // The Resend SDK throws synchronously if the key is missing, so the
    // client is built lazily on first send — an unset key during local dev
    // (before Resend is configured) shouldn't crash the whole API process
    // just because auth.routes.ts constructs this provider at boot.
    this.options = options;
  }

  async send(identifier: string, code: string): Promise<void> {
    if (!this.options.apiKey) {
      throw new Error("RESEND_API_KEY is not configured — set it in apps/api/.env.local");
    }
    this.client ??= new Resend(this.options.apiKey);
    await this.client.emails.send({
      from: this.options.fromAddress,
      to: identifier,
      subject: `${code} is your DurgaPandals verification code`,
      text: `Your verification code is ${code}. It expires in 10 minutes.`,
    });
  }
}
