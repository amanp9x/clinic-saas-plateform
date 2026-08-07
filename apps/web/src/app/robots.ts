import type { MetadataRoute } from 'next';
import { clientEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account',
        '/login',
        '/register',
        '/otp-login',
        '/reset-password',
        '/verify-email',
      ],
    },
    sitemap: `${clientEnv.siteUrl}/sitemap.xml`,
  };
}
