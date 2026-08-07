import { env, isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';

interface SendSmsInput {
  to: string;
  message: string;
}

/**
 * SMS provider abstraction. No provider is wired up yet (SMS_PROVIDER is unset), so this
 * logs instead of sending — swap in Twilio/MSG91/etc. here without touching call sites.
 */
export async function sendSms(input: SendSmsInput): Promise<void> {
  if (!env.SMS_PROVIDER) {
    if (isProduction) {
      logger.error({ to: input.to }, 'SMS provider not configured — SMS not sent');
      return;
    }
    logger.info({ to: input.to, message: input.message }, '[dev sms] would send');
    return;
  }

  throw new Error(`SMS provider "${env.SMS_PROVIDER}" is not implemented yet`);
}
