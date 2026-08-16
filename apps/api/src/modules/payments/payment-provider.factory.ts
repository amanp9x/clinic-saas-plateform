import { env, isTest } from '../../config/env.js';
import type { PaymentProviderClient } from './payment-provider.interface.js';
import { mockProvider } from './providers/mock-provider.js';
import { razorpayProvider } from './providers/razorpay-provider.js';

/**
 * Selects the active provider once at module load. Automated tests always get the mock provider
 * regardless of env config, so the suite never depends on real credentials. Outside tests: an
 * explicit `PAYMENT_PROVIDER=razorpay` (with credentials present) opts in to the real provider;
 * anything else — including brand-new environments with no payment config at all — safely falls
 * back to the mock provider rather than failing to boot.
 */
function selectProvider(): PaymentProviderClient {
  if (isTest) return mockProvider;
  if (env.PAYMENT_PROVIDER === 'razorpay' && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
    return razorpayProvider;
  }
  return mockProvider;
}

export const activePaymentProvider: PaymentProviderClient = selectProvider();

export function getProviderByName(name: 'MOCK' | 'RAZORPAY' | 'STRIPE'): PaymentProviderClient {
  if (name === 'MOCK') return mockProvider;
  if (name === 'RAZORPAY') return razorpayProvider;
  throw new Error(`Unsupported or unconfigured payment provider: ${name}`);
}
