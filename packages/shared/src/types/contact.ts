import type { ContactMessageStatus } from '../enums.js';

/** Phase 22 — Contact Message Triage. Submitters are anonymous site visitors (no User/session),
 * so there is no in-app notification target and no bidirectional conversation thread — an admin
 * reply is a one-shot outbound email to the address they supplied, not a chat. */
export interface ContactMessageRowDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  status: ContactMessageStatus;
  createdAt: string;
}

export interface ContactMessageDetailDto extends ContactMessageRowDto {
  message: string;
  adminReply: string | null;
  respondedAt: string | null;
}
