import { prisma } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import { activeEmailProvider } from './email/email-provider.factory.js';
import type { RenderedEmail } from './email/templates.js';

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 150, 400]; // no delay before the first attempt, short bounded backoff after

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

/**
 * Sends one email for a notification and records the attempt(s) as a NotificationDelivery row.
 * Retries inline, bounded to MAX_ATTEMPTS with a short backoff — this codebase has no background
 * job queue, so "retry" here means "try up to 3 times within this call," not a deferred worker.
 * A failed delivery never throws back to the caller: the in-app notification is already
 * persisted and must survive regardless of email outcome.
 */
export async function deliverNotificationEmail(input: { notificationId: string; recipientEmail: string; email: RenderedEmail }): Promise<void> {
  const delivery = await prisma.notificationDelivery.create({
    data: {
      notificationId: input.notificationId,
      recipientEmail: input.recipientEmail,
      provider: activeEmailProvider.name,
      status: 'QUEUED',
    },
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    await sleep(BACKOFF_MS[attempt - 1] ?? 400);
    try {
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENDING', attempts: attempt, lastAttemptAt: new Date() },
      });
      const result = await activeEmailProvider.send({ to: input.recipientEmail, subject: input.email.subject, html: input.email.html, text: input.email.text });
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: { status: 'SENT', sentAt: new Date(), providerMessageId: result.providerMessageId },
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }

  const failureReason = lastError instanceof Error ? lastError.message : 'Email delivery failed';
  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: { status: 'FAILED', failureReason },
  });
  logger.warn({ notificationId: input.notificationId, recipientEmail: input.recipientEmail, failureReason }, 'Notification email delivery failed after retries');
}
