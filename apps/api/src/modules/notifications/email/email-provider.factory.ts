import { isTest } from '../../../config/env.js';
import type { EmailProviderClient } from './email-provider.interface.js';
import { mockEmailProvider } from './mock-email-provider.js';
import { smtpEmailProvider } from './smtp-email-provider.js';

/** Tests always get the deterministic mock provider, regardless of SMTP env config, so the suite
 * never depends on (or accidentally sends through) a real mail server. Outside tests, the SMTP
 * provider is used — it already degrades safely (dev-log fallback) when unconfigured. */
export const activeEmailProvider: EmailProviderClient = isTest ? mockEmailProvider : smtpEmailProvider;
