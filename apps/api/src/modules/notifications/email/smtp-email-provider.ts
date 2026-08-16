import { sendEmail } from '../../../services/mailer.service.js';
import type { EmailProviderClient, SendEmailInput, SendEmailResult } from './email-provider.interface.js';

/**
 * Thin wrapper around the existing `mailer.service.ts::sendEmail` (already the codebase's
 * provider-agnostic SMTP abstraction from earlier phases — SMTP-if-configured, safe dev-log
 * fallback otherwise, never fails app startup). Not duplicated here, just exposed behind the
 * same `EmailProviderClient` shape the mock provider implements, so notification code depends on
 * one interface regardless of which concrete implementation is active.
 */
export const smtpEmailProvider: EmailProviderClient = {
  name: 'smtp',
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    await sendEmail(input);
    // mailer.service.ts's nodemailer transport doesn't currently surface a provider message id
    // back to callers — nothing here to store beyond "it didn't throw".
    return { providerMessageId: null };
  },
};
