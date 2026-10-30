import * as React from "react";
import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { OrderConfirmationEmail } from "./templates/OrderConfirmationEmail";
import { OrderShippedEmail } from "./templates/OrderShippedEmail";
import { PasswordResetEmail } from "./templates/PasswordResetEmail";
import { PaymentReceivedEmail } from "./templates/PaymentReceivedEmail";
import { VerificationEmail } from "./templates/VerificationEmail";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  react?: React.ReactNode;
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
  sendOrderConfirmationEmail(options: {
    to: string;
    orderNumber: string;
    totalAmountFormatted: string;
    orderUrl?: string;
  }): Promise<void>;
  sendPaymentReceivedEmail(options: {
    to: string;
    orderNumber: string;
    totalAmountFormatted: string;
    paymentMethod: string;
    orderUrl?: string;
  }): Promise<void>;
  sendOrderShippedEmail(options: {
    to: string;
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
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

  async sendOrderConfirmationEmail(options: {
    to: string;
    orderNumber: string;
    totalAmountFormatted: string;
    orderUrl?: string;
  }): Promise<void> {
    logger.info(
      { to: options.to, orderNumber: options.orderNumber },
      "Development Email: Sending order confirmation",
    );
    console.log(
      "\n=======================================================\n" +
        "[MERCATO DEV EMAIL SERVICE - ORDER CONFIRMATION]\n" +
        `To: ${options.to}\n` +
        `Order Number: ${options.orderNumber}\n` +
        `Total: ${options.totalAmountFormatted}\n` +
        `Order URL: ${options.orderUrl ?? "N/A"}\n` +
        "=======================================================\n",
    );
  }

  async sendPaymentReceivedEmail(options: {
    to: string;
    orderNumber: string;
    totalAmountFormatted: string;
    paymentMethod: string;
    orderUrl?: string;
  }): Promise<void> {
    logger.info(
      { to: options.to, orderNumber: options.orderNumber },
      "Development Email: Sending payment received confirmation",
    );
    console.log(
      "\n=======================================================\n" +
        "[MERCATO DEV EMAIL SERVICE - PAYMENT RECEIVED]\n" +
        `To: ${options.to}\n` +
        `Order Number: ${options.orderNumber}\n` +
        `Amount: ${options.totalAmountFormatted}\n` +
        `Method: ${options.paymentMethod}\n` +
        `Order URL: ${options.orderUrl ?? "N/A"}\n` +
        "=======================================================\n",
    );
  }

  async sendOrderShippedEmail(options: {
    to: string;
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
  }): Promise<void> {
    logger.info(
      { to: options.to, orderNumber: options.orderNumber },
      "Development Email: Sending order shipped notification",
    );
    console.log(
      "\n=======================================================\n" +
        "[MERCATO DEV EMAIL SERVICE - ORDER SHIPPED]\n" +
        `To: ${options.to}\n` +
        `Order Number: ${options.orderNumber}\n` +
        `Carrier: ${options.carrier}\n` +
        `Tracking Number: ${options.trackingNumber}\n` +
        `Tracking URL: ${options.trackingUrl ?? "N/A"}\n` +
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

export class ResendEmailService implements EmailService {
  private resend: Resend;
  private from: string;

  constructor(apiKey: string, from?: string) {
    this.resend = new Resend(apiKey);
    this.from = from || process.env.EMAIL_FROM || "Mercato <onboarding@resend.dev>";
  }

  async sendVerificationEmail(options: {
    to: string;
    url: string;
    token: string;
    userName?: string;
  }): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: "Verify your email address - Mercato",
        react: React.createElement(VerificationEmail, {
          userName: options.userName,
          verificationUrl: options.url,
        }),
      });
      logger.info({ to: options.to }, "Resend: Verification email dispatched successfully");
    } catch (error) {
      logger.error({ err: error, to: options.to }, "Resend: Failed to send verification email");
      throw error;
    }
  }

  async sendPasswordResetEmail(options: {
    to: string;
    url: string;
    token: string;
    userName?: string;
  }): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: "Reset your password - Mercato",
        react: React.createElement(PasswordResetEmail, {
          userName: options.userName,
          resetUrl: options.url,
        }),
      });
      logger.info({ to: options.to }, "Resend: Password reset email dispatched successfully");
    } catch (error) {
      logger.error({ err: error, to: options.to }, "Resend: Failed to send password reset email");
      throw error;
    }
  }

  async sendOrderConfirmationEmail(options: {
    to: string;
    orderNumber: string;
    totalAmountFormatted: string;
    orderUrl?: string;
  }): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: `Order #${options.orderNumber} Confirmation - Mercato`,
        react: React.createElement(OrderConfirmationEmail, {
          orderNumber: options.orderNumber,
          totalAmountFormatted: options.totalAmountFormatted,
          orderUrl: options.orderUrl,
        }),
      });
      logger.info(
        { to: options.to, orderNumber: options.orderNumber },
        "Resend: Order confirmation email dispatched",
      );
    } catch (error) {
      logger.error(
        { err: error, to: options.to, orderNumber: options.orderNumber },
        "Resend: Failed to send order confirmation email",
      );
      throw error;
    }
  }

  async sendPaymentReceivedEmail(options: {
    to: string;
    orderNumber: string;
    totalAmountFormatted: string;
    paymentMethod: string;
    orderUrl?: string;
  }): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: `Payment Confirmed for Order #${options.orderNumber} - Mercato`,
        react: React.createElement(PaymentReceivedEmail, {
          orderNumber: options.orderNumber,
          totalAmountFormatted: options.totalAmountFormatted,
          paymentMethod: options.paymentMethod,
          orderUrl: options.orderUrl,
        }),
      });
      logger.info(
        { to: options.to, orderNumber: options.orderNumber },
        "Resend: Payment received email dispatched",
      );
    } catch (error) {
      logger.error(
        { err: error, to: options.to, orderNumber: options.orderNumber },
        "Resend: Failed to send payment received email",
      );
      throw error;
    }
  }

  async sendOrderShippedEmail(options: {
    to: string;
    orderNumber: string;
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
  }): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: `Your Mercato Order #${options.orderNumber} Has Shipped!`,
        react: React.createElement(OrderShippedEmail, {
          orderNumber: options.orderNumber,
          trackingNumber: options.trackingNumber,
          carrier: options.carrier,
          trackingUrl: options.trackingUrl,
        }),
      });
      logger.info(
        { to: options.to, orderNumber: options.orderNumber },
        "Resend: Order shipped email dispatched",
      );
    } catch (error) {
      logger.error(
        { err: error, to: options.to, orderNumber: options.orderNumber },
        "Resend: Failed to send order shipped email",
      );
      throw error;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    try {
      if (options.react) {
        await this.resend.emails.send({
          from: this.from,
          to: options.to,
          subject: options.subject,
          react: options.react,
        });
      } else if (options.html) {
        await this.resend.emails.send({
          from: this.from,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });
      } else {
        await this.resend.emails.send({
          from: this.from,
          to: options.to,
          subject: options.subject,
          text: options.text ?? options.subject,
        });
      }
      logger.info({ to: options.to, subject: options.subject }, "Resend: Generic email dispatched");
    } catch (error) {
      logger.error(
        { err: error, to: options.to, subject: options.subject },
        "Resend: Failed to send generic email",
      );
      throw error;
    }
  }
}

// Select email implementation: Console in development/testing, or Resend in production if valid key provided
function createEmailService(): EmailService {
  const resendApiKey = process.env.RESEND_API_KEY;
  const isRealResendKey =
    resendApiKey?.startsWith("re_") &&
    !resendApiKey.includes("sample") &&
    !resendApiKey.includes("test");

  if (isRealResendKey && resendApiKey) {
    return new ResendEmailService(resendApiKey);
  }

  return new ConsoleEmailService();
}

export const emailService: EmailService = createEmailService();
