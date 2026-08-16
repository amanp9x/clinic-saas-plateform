export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  providerMessageId: string | null;
}

/** Provider-agnostic email abstraction — notification-dispatch/email-delivery services call only
 * this interface, never a specific transport, so swapping providers never touches call sites. */
export interface EmailProviderClient {
  readonly name: string;
  send(input: SendEmailInput): Promise<SendEmailResult>;
}
