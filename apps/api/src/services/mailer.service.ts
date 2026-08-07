import nodemailer, { type Transporter } from 'nodemailer';
import { env, isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

/**
 * Sends transactional email via SMTP when configured. In dev/test (or whenever SMTP
 * isn't configured), logs the message instead of sending — lets the auth flows run
 * end-to-end locally without real mail credentials, without pretending mail was sent.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const client = getTransporter();

  if (!client) {
    if (isProduction) {
      logger.error(
        { to: input.to, subject: input.subject },
        'SMTP not configured — email not sent',
      );
      return;
    }
    logger.info(
      { to: input.to, subject: input.subject, text: input.text },
      '[dev email] would send',
    );
    return;
  }

  await client.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
