import { logger } from "@/lib/logger";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface EmailService {
  sendVerificationEmail(options: {
    to: string;
    url: string;
    token: string;
    userName?: string;
  }): Promise<void>;
  sendPasswordResetEmail(options: {
    to: string;
    url: string;
    token: string;
    userName?: string;
  }): Promise<void>;
  sendEmail(options: SendEmailOptions): Promise<void>;
}

export class ConsoleEmailService implements EmailService {
  async sendVerificationEmail(options: {
    to: string;
    url: string;
    token: string;
    userName?: string;
  }): Promise<void> {
    logger.info(
      { to: options.to, url: options.url },
      "Development Email: Sending email verification link",
    );
    console.log(
      "\n=======================================================\n" +
        "[MERCATO DEV EMAIL SERVICE - EMAIL VERIFICATION]\n" +
        `To: ${options.to}\n` +
        `Name: ${options.userName ?? "Valued Customer"}\n` +
        `Verification URL: ${options.url}\n` +
        `Verification Token: ${options.token}\n` +
        "=======================================================\n",
    );
  }

  async sendPasswordResetEmail(options: {
    to: string;
    url: string;
    token: string;
    userName?: string;
  }): Promise<void> {
    logger.info(
      { to: options.to, url: options.url },
      "Development Email: Sending password reset link",
    );
    console.log(
      "\n=======================================================\n" +
        "[MERCATO DEV EMAIL SERVICE - PASSWORD RESET]\n" +
        `To: ${options.to}\n` +
        `Name: ${options.userName ?? "User"}\n` +
        `Reset URL: ${options.url}\n` +
        `Reset Token: ${options.token}\n` +
        "=======================================================\n",
    );
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    logger.info(
      { to: options.to, subject: options.subject },
      "Development Email: Generic email dispatched",
    );
    console.log(
      "\n=======================================================\n" +
        `[MERCATO DEV EMAIL SERVICE - ${options.subject.toUpperCase()}]\n` +
        `To: ${options.to}\n` +
        `Subject: ${options.subject}\n` +
        `Body:\n${options.text ?? options.html ?? "(Empty message body)"}\n` +
        "=======================================================\n",
    );
  }
}

// Select email implementation: Console in development/testing, or Resend in production
function createEmailService(): EmailService {
  const resendApiKey = process.env.RESEND_API_KEY;
  const isRealResendKey = resendApiKey?.startsWith("re_") && !resendApiKey.includes("sample");

  if (isRealResendKey) {
    // Production Resend provider adapter will be wired in Phase 4
    return new ConsoleEmailService();
  }

  return new ConsoleEmailService();
}

export const emailService: EmailService = createEmailService();
