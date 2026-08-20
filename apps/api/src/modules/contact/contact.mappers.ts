import type { ContactMessage } from '@prisma/client';
import type { ContactMessageDetailDto, ContactMessageRowDto } from '@clinic/shared';

export function toContactMessageRowDto(message: ContactMessage): ContactMessageRowDto {
  return {
    id: message.id,
    name: message.name,
    email: message.email,
    phone: message.phone,
    subject: message.subject,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toContactMessageDetailDto(message: ContactMessage): ContactMessageDetailDto {
  return {
    ...toContactMessageRowDto(message),
    message: message.message,
    adminReply: message.adminReply,
    respondedAt: message.respondedAt ? message.respondedAt.toISOString() : null,
  };
}
