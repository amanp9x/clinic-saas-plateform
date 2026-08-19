'use client';

import Link from 'next/link';
import { Bell, CalendarClock, ClipboardList, Clock, CreditCard, FlaskConical, LifeBuoy, Megaphone, Pill, Radio, ShieldAlert, ShieldCheck, Stethoscope } from 'lucide-react';
import type { NotificationDto, NotificationType } from '@clinic/shared';
import { useMarkNotificationRead } from '@/hooks/doctor/use-doctor-notifications';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';

const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  APPOINTMENT_UPDATE: CalendarClock,
  QUEUE_UPDATE: Radio,
  PRESCRIPTION_READY: Pill,
  REPORT_READY: FlaskConical,
  SYSTEM: Bell,

  APPOINTMENT_BOOKED: CalendarClock,
  APPOINTMENT_CONFIRMED: CalendarClock,
  APPOINTMENT_RESCHEDULED: CalendarClock,
  APPOINTMENT_CANCELLED: CalendarClock,
  APPOINTMENT_CHECKED_IN: Radio,
  APPOINTMENT_NO_SHOW: CalendarClock,
  APPOINTMENT_REMINDER: CalendarClock,
  APPOINTMENT_STARTING_SOON: CalendarClock,

  PAYMENT_PENDING: CreditCard,
  PAYMENT_SUCCESS: CreditCard,
  PAYMENT_FAILED: CreditCard,
  PAYMENT_REFUNDED: CreditCard,
  PAYMENT_REFUND_PENDING: CreditCard,

  QUEUE_CHECKED_IN: Radio,
  PATIENT_CALLED: Radio,
  PATIENT_SKIPPED: Radio,
  QUEUE_DELAY_UPDATED: Radio,
  DOCTOR_DELAYED: Radio,
  DOCTOR_ON_TIME: Radio,
  QUEUE_PAUSED: Radio,
  QUEUE_RESUMED: Radio,

  CONSULTATION_STARTED: Stethoscope,
  CONSULTATION_COMPLETED: Stethoscope,

  DOCTOR_STATUS_CHANGED: Stethoscope,

  CLINIC_ANNOUNCEMENT: Megaphone,

  REVIEW_RECEIVED: Megaphone,
  REVIEW_RESPONSE: Megaphone,
  REVIEW_HIDDEN: Megaphone,

  WAITLIST_SLOT_AVAILABLE: Clock,

  FOLLOW_UP_DUE: ClipboardList,

  CLINIC_VERIFICATION_UPDATED: ShieldCheck,

  SUPPORT_TICKET_UPDATE: LifeBuoy,

  CLINIC_DOCUMENT_EXPIRING: ShieldCheck,

  SECURITY_LOGIN: ShieldAlert,
  SECURITY_PASSWORD_CHANGED: ShieldAlert,
};

function resolveHref(notification: NotificationDto): string | null {
  if (notification.actionUrl) {
    // Notification action URLs are patient-portal-relative (e.g. /appointments/:id) — the doctor
    // portal mounts the equivalent route under /doctor/*.
    return notification.actionUrl.startsWith('/appointments/') ? `/doctor${notification.actionUrl}` : notification.actionUrl;
  }
  if (notification.relatedEntityType === 'Appointment' && notification.relatedEntityId) {
    return `/doctor/appointments/${notification.relatedEntityId}`;
  }
  if (notification.type === 'QUEUE_UPDATE') return '/doctor/queue';
  return null;
}

export function DoctorNotificationItem({ notification }: { notification: NotificationDto }) {
  const markRead = useMarkNotificationRead();
  const Icon = TYPE_ICON[notification.type];
  const href = resolveHref(notification);

  const handleClick = () => {
    if (!notification.isRead) markRead.mutate(notification.id);
  };

  const content = (
    <Card className={cn('transition-colors', !notification.isRead && 'bg-primary/5 border-primary/30')}>
      <CardContent className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{notification.title}</p>
            <div className="flex shrink-0 items-center gap-2">
              {(notification.priority === 'HIGH' || notification.priority === 'CRITICAL') && (
                <Badge variant={notification.priority === 'CRITICAL' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {notification.priority}
                </Badge>
              )}
              {!notification.isRead && <span className="bg-primary size-2 shrink-0 rounded-full" />}
            </div>
          </div>
          <p className="text-muted-foreground text-sm">{notification.message}</p>
          <p className="text-muted-foreground/80 mt-1 text-xs">{formatRelativeTime(notification.createdAt)}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} onClick={handleClick} className="block">
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className="block w-full text-left" disabled={notification.isRead}>
      {content}
    </button>
  );
}
