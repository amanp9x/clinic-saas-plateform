import crypto from 'node:crypto';
import type { EmailProviderClient, SendEmailInput, SendEmailResult } from './email-provider.interface.js';

/** Captured for test assertions only — cleared between test files via `clearMockEmailOutbox()`. */
export const mockEmailOutbox: SendEmailInput[] = [];

export function clearMockEmailOutbox(): void {
  mockEmailOutbox.length = 0;
}

/**
 * Deterministic, in-memory provider used automatically whenever the app runs in test mode (see
 * email-provider.factory.ts) — no network calls, no real SMTP credentials needed. Tests trigger a
 * simulated delivery failure by addressing an email to a recipient containing `+forcefail`
 * (mirrors how real payment providers use magic test values), which is what the bounded-retry
 * tests exercise.
 */
export const mockEmailProvider: EmailProviderClient = {
  name: 'mock',
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (input.to.includes('+forcefail')) {
      throw new Error('Mock email provider: simulated delivery failure');
    }
    mockEmailOutbox.push(input);
    return { providerMessageId: `mock_msg_${crypto.randomBytes(8).toString('hex')}` };
  },
};
