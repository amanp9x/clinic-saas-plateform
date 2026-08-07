process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://clinic:clinic@localhost:5432/clinic_saas_test?schema=public';
process.env.REDIS_URL ??= 'redis://localhost:6379/1';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-please-change';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-please-change';
process.env.COOKIE_SECRET ??= 'test-cookie-secret-please-change';
