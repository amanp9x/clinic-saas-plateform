import { UAParser } from 'ua-parser-js';

/** Turns a raw User-Agent header into a short human-readable label, e.g. "Chrome on Windows". */
export function parseDeviceLabel(userAgent: string | undefined): string | null {
  if (!userAgent) return null;

  const { browser, os } = UAParser(userAgent);
  const parts = [browser.name, os.name].filter(Boolean);
  return parts.length > 0 ? parts.join(' on ') : null;
}
