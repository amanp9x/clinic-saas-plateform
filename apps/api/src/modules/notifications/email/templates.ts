export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface ShellInput {
  heading: string;
  lines: string[];
  actionLabel?: string;
  actionUrl?: string;
  clinicName?: string | null;
}

/**
 * One reusable HTML/text shell every template below renders through — "reusable templates" means
 * a shared structure with distinct, template-specific copy, not twelve independently designed
 * documents. Deliberately plain (no external assets/fonts) so it renders consistently across mail
 * clients without a design-system dependency.
 */
function renderShell(input: ShellInput): { html: string; text: string } {
  const paragraphs = input.lines.map((line) => `<p style="margin:0 0 12px;color:#333;font-size:14px;line-height:1.5;">${line}</p>`).join('');
  const button = input.actionUrl
    ? `<p style="margin:20px 0 0;"><a href="${input.actionUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">${input.actionLabel ?? 'View details'}</a></p>`
    : '';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      ${input.clinicName ? `<p style="margin:0 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">${input.clinicName}</p>` : ''}
      <h1 style="margin:0 0 16px;color:#0f172a;font-size:20px;">${input.heading}</h1>
      ${paragraphs}
      ${button}
      <p style="margin:24px 0 0;color:#999;font-size:12px;">This is an automated message from your clinic portal. Please do not reply to this email.</p>
    </div>`;
  const text = [input.clinicName, input.heading, ...input.lines, input.actionUrl ? `${input.actionLabel ?? 'View details'}: ${input.actionUrl}` : null]
    .filter(Boolean)
    .join('\n\n');
  return { html, text };
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDateOnly(date: Date): string {
  return date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export interface AppointmentEmailContext {
  clinicName: string;
  doctorName: string;
  patientName: string;
  bookingReference: string;
  scheduledAt: Date;
  actionUrl: string;
}

export function appointmentBookedEmail(ctx: AppointmentEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Appointment booked',
    lines: [
      `Hi ${ctx.patientName}, your appointment with ${ctx.doctorName} on ${formatDateTime(ctx.scheduledAt)} has been booked.`,
      `Reference: ${ctx.bookingReference}.`,
    ],
    actionLabel: 'View appointment',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `Appointment booked — ${ctx.bookingReference}`, html, text };
}

export function appointmentConfirmedEmail(ctx: AppointmentEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Appointment confirmed',
    lines: [
      `Hi ${ctx.patientName}, your appointment with ${ctx.doctorName} on ${formatDateTime(ctx.scheduledAt)} is confirmed.`,
      `Reference: ${ctx.bookingReference}.`,
    ],
    actionLabel: 'View appointment',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `Appointment confirmed — ${ctx.bookingReference}`, html, text };
}

export function appointmentRescheduledEmail(ctx: AppointmentEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Appointment rescheduled',
    lines: [`Hi ${ctx.patientName}, your appointment with ${ctx.doctorName} has been moved to ${formatDateTime(ctx.scheduledAt)}.`, `Reference: ${ctx.bookingReference}.`],
    actionLabel: 'View appointment',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `Appointment rescheduled — ${ctx.bookingReference}`, html, text };
}

export function appointmentCancelledEmail(ctx: AppointmentEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Appointment cancelled',
    lines: [`Hi ${ctx.patientName}, your appointment with ${ctx.doctorName} on ${formatDateTime(ctx.scheduledAt)} has been cancelled.`, `Reference: ${ctx.bookingReference}.`],
    actionLabel: 'View appointment',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `Appointment cancelled — ${ctx.bookingReference}`, html, text };
}

export function appointmentReminderEmail(ctx: AppointmentEmailContext & { timingLabel: string }): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Appointment reminder',
    lines: [`Hi ${ctx.patientName}, this is a reminder that you have an appointment with ${ctx.doctorName} ${ctx.timingLabel} (${formatDateTime(ctx.scheduledAt)}).`, `Reference: ${ctx.bookingReference}.`],
    actionLabel: 'View appointment',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `Reminder: appointment ${ctx.timingLabel}`, html, text };
}

export interface FollowUpDueEmailContext {
  clinicName: string;
  patientName: string;
  doctorName: string;
  followUpDate: Date;
  actionUrl: string;
}

export function followUpDueEmail(ctx: FollowUpDueEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Follow-up recommended',
    lines: [
      `Hi ${ctx.patientName}, ${ctx.doctorName} recommended a follow-up visit around ${formatDateOnly(ctx.followUpDate)}.`,
      `You can book a slot whenever suits you — sooner is better if you're still experiencing symptoms.`,
    ],
    actionLabel: 'Book follow-up',
    actionUrl: ctx.actionUrl,
  });
  return { subject: 'Follow-up visit recommended', html, text };
}

export interface PaymentEmailContext {
  clinicName: string;
  patientName: string;
  bookingReference: string;
  amount: number;
  currency: string;
  actionUrl: string;
}

function formatMoney(amount: number, currency: string): string {
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  return `${symbol}${amount.toLocaleString('en-IN')}`;
}

export function paymentSuccessfulEmail(ctx: PaymentEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Payment successful',
    lines: [`Hi ${ctx.patientName}, we received your payment of ${formatMoney(ctx.amount, ctx.currency)} for appointment ${ctx.bookingReference}.`],
    actionLabel: 'View receipt',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `Payment received — ${ctx.bookingReference}`, html, text };
}

export function paymentFailedEmail(ctx: PaymentEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Payment failed',
    lines: [`Hi ${ctx.patientName}, your payment for appointment ${ctx.bookingReference} could not be completed. You can retry from your appointment.`],
    actionLabel: 'Retry payment',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `Payment failed — ${ctx.bookingReference}`, html, text };
}

export function refundCompletedEmail(ctx: PaymentEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Refund completed',
    lines: [`Hi ${ctx.patientName}, a refund of ${formatMoney(ctx.amount, ctx.currency)} for appointment ${ctx.bookingReference} has been processed.`],
    actionLabel: 'View details',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `Refund processed — ${ctx.bookingReference}`, html, text };
}

/** Never includes medicine names, dosages, or diagnosis — only points to the authenticated app. */
export function prescriptionReadyEmail(ctx: { clinicName: string; patientName: string; doctorName: string; actionUrl: string }): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Your prescription is ready',
    lines: [`Hi ${ctx.patientName}, ${ctx.doctorName} has issued a new prescription for you. Sign in to view it securely.`],
    actionLabel: 'View prescription',
    actionUrl: ctx.actionUrl,
  });
  return { subject: 'Your prescription is ready', html, text };
}

export function doctorDelayedEmail(ctx: { clinicName: string; patientName: string; doctorName: string; delayMinutes: number; actionUrl: string }): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: 'Doctor running late',
    lines: [`Hi ${ctx.patientName}, ${ctx.doctorName} is running approximately ${ctx.delayMinutes} minutes late.`],
    actionLabel: 'View queue status',
    actionUrl: ctx.actionUrl,
  });
  return { subject: `${ctx.doctorName} is running late`, html, text };
}

export function securityLoginEmail(ctx: { patientName: string; whenLabel: string; actionUrl: string }): RenderedEmail {
  const { html, text } = renderShell({
    heading: 'New sign-in to your account',
    lines: [`Hi ${ctx.patientName}, we noticed a new sign-in to your account ${ctx.whenLabel}. If this was you, no action is needed.`],
    actionLabel: 'Review account security',
    actionUrl: ctx.actionUrl,
  });
  return { subject: 'New sign-in to your account', html, text };
}

export interface DocumentExpiryEmailContext {
  clinicName: string;
  documentTypeLabel: string;
  fileName: string;
  expiryDate: Date;
  isExpired: boolean;
  actionUrl: string;
}

export function clinicDocumentExpiringEmail(ctx: DocumentExpiryEmailContext): RenderedEmail {
  const { html, text } = renderShell({
    clinicName: ctx.clinicName,
    heading: ctx.isExpired ? 'A compliance document has expired' : 'A compliance document is expiring soon',
    lines: [
      ctx.isExpired
        ? `Your ${ctx.documentTypeLabel} ("${ctx.fileName}") expired on ${formatDateOnly(ctx.expiryDate)}. Please upload a renewed copy as soon as possible.`
        : `Your ${ctx.documentTypeLabel} ("${ctx.fileName}") expires on ${formatDateOnly(ctx.expiryDate)}. Please renew it before then to stay compliant.`,
    ],
    actionLabel: 'Manage documents',
    actionUrl: ctx.actionUrl,
  });
  return { subject: ctx.isExpired ? 'Compliance document expired' : 'Compliance document expiring soon', html, text };
}
