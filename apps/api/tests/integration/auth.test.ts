import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { sendEmailMock, sendSmsMock } = vi.hoisted(() => ({
  sendEmailMock: vi.fn((_args: { to: string; subject: string; html: string; text: string }) =>
    Promise.resolve(),
  ),
  sendSmsMock: vi.fn((_args: { to: string; message: string }) => Promise.resolve()),
}));

vi.mock('../../src/services/mailer.service.js', () => ({ sendEmail: sendEmailMock }));
vi.mock('../../src/services/sms.service.js', () => ({ sendSms: sendSmsMock }));

const { createApp } = await import('../../src/app.js');
const { resetAuthTables } = await import('../helpers/db.js');
const { prisma } = await import('../../src/config/database.js');

const app = createApp();

function extractCode(text: string): string {
  const match = /\b(\d{6})\b/.exec(text);
  if (!match) throw new Error(`No 6-digit code found in: ${text}`);
  return match[1]!;
}

function lastEmailCodeTo(email: string): string {
  const call = sendEmailMock.mock.calls.findLast(([arg]) => arg.to === email);
  if (!call) throw new Error(`No email sent to ${email}`);
  return extractCode(call[0].text);
}

function lastSmsCodeTo(phone: string): string {
  const call = sendSmsMock.mock.calls.findLast(([arg]) => arg.to === phone);
  if (!call) throw new Error(`No SMS sent to ${phone}`);
  return extractCode(call[0].message);
}

function refreshCookieFrom(res: {
  headers: Record<string, string[] | string | undefined>;
}): string {
  const setCookie = res.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const match = cookies.map((c) => /refreshToken=([^;]+)/.exec(c)?.[1]).find(Boolean);
  if (!match) throw new Error('No refreshToken cookie in response');
  return match;
}

const PASSWORD = 'Sup3rSecret!';

async function registerUser(email: string, phone?: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password: PASSWORD, fullName: 'Test User', phone });
  return res;
}

beforeEach(async () => {
  await resetAuthTables();
  sendEmailMock.mockClear();
  sendSmsMock.mockClear();
});

describe('POST /api/v1/auth/register', () => {
  it('creates a user, issues tokens, and sends a verification email', async () => {
    const res = await registerUser('register@example.com');

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('register@example.com');
    expect(res.body.data.user.isEmailVerified).toBe(false);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.headers['set-cookie']?.[0]).toMatch(/refreshToken=.*HttpOnly/i);
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser('dupe@example.com');
    const res = await registerUser('dupe@example.com');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects a weak password with a 400 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'weak@example.com', password: 'weak', fullName: 'Test User' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('logs in with correct credentials', async () => {
    await registerUser('login@example.com');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('login@example.com');
  });

  it('rejects an incorrect password without revealing which field was wrong', async () => {
    await registerUser('login2@example.com');
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login2@example.com', password: 'WrongPass1!' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('locks the account after repeated failed attempts', async () => {
    await registerUser('lockout@example.com');

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'lockout@example.com', password: 'WrongPass1!' });
    }

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'lockout@example.com', password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('refresh token rotation', () => {
  it('rotates the token on refresh and rejects the old one on reuse (revoking the session)', async () => {
    const agent = request.agent(app);
    const regRes = await agent
      .post('/api/v1/auth/register')
      .send({ email: 'rotate@example.com', password: PASSWORD, fullName: 'Test User' });

    const originalRefreshToken = refreshCookieFrom(regRes);
    expect(originalRefreshToken).toBeTruthy();

    const rotated = await agent.post('/api/v1/auth/refresh').send({});
    expect(rotated.status).toBe(200);

    // Reusing the pre-rotation token must fail...
    const reused = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken });
    expect(reused.status).toBe(401);

    // ...and must have revoked the whole session, so even the freshly-rotated token now fails.
    const afterReuse = await agent.post('/api/v1/auth/refresh').send({});
    expect(afterReuse.status).toBe(401);
  });
});

describe('password change / forgot / reset', () => {
  it('changes the password and revokes other sessions but keeps the current one', async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    const regRes = await agentA
      .post('/api/v1/auth/register')
      .send({ email: 'changepw@example.com', password: PASSWORD, fullName: 'Test User' });
    const token = regRes.body.data.accessToken;

    await agentB
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@example.com', password: PASSWORD });

    const changeRes = await agentA
      .post('/api/v1/auth/password/change')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'NewPass123!' });
    expect(changeRes.status).toBe(200);

    const sessionsRes = await agentA
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(sessionsRes.body.data.sessions).toHaveLength(1);
    expect(sessionsRes.body.data.sessions[0].isCurrent).toBe(true);

    const oldPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@example.com', password: PASSWORD });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'changepw@example.com', password: 'NewPass123!' });
    expect(newPasswordLogin.status).toBe(200);
  });

  it('resets the password via emailed code and revokes all sessions', async () => {
    await registerUser('forgot@example.com');
    sendEmailMock.mockClear();

    const forgotRes = await request(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'forgot@example.com' });
    expect(forgotRes.status).toBe(200);

    const code = lastEmailCodeTo('forgot@example.com');
    const resetRes = await request(app)
      .post('/api/v1/auth/password/reset')
      .send({ email: 'forgot@example.com', code, newPassword: 'ResetPass123!' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'forgot@example.com', password: 'ResetPass123!' });
    expect(loginRes.status).toBe(200);
  });

  it('never reveals whether an email exists via /password/forgot', async () => {
    const res = await request(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'does-not-exist@example.com' });
    expect(res.status).toBe(200);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe('OTP login', () => {
  it('auto-provisions a new patient on first-time phone OTP login', async () => {
    const identifier = '+919876543210';
    const requestRes = await request(app).post('/api/v1/auth/otp/request').send({ identifier });
    expect(requestRes.status).toBe(200);

    const code = lastSmsCodeTo(identifier);
    const verifyRes = await request(app).post('/api/v1/auth/otp/verify').send({ identifier, code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.isNewUser).toBe(true);
    expect(verifyRes.body.data.user.phone).toBe(identifier);
    expect(verifyRes.body.data.user.isMobileVerified).toBe(true);
  });

  it('logs in an existing user and marks the channel verified', async () => {
    await registerUser('otpuser@example.com');

    const requestRes = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ identifier: 'otpuser@example.com' });
    expect(requestRes.status).toBe(200);

    const code = lastEmailCodeTo('otpuser@example.com');
    const verifyRes = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ identifier: 'otpuser@example.com', code });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.isNewUser).toBe(false);
    expect(verifyRes.body.data.user.isEmailVerified).toBe(true);
  });

  it('rejects an incorrect code and increments attempts', async () => {
    const identifier = '+911111111111';
    await request(app).post('/api/v1/auth/otp/request').send({ identifier });

    const res = await request(app)
      .post('/api/v1/auth/otp/verify')
      .send({ identifier, code: '000000' });
    expect(res.status).toBe(401);
  });
});

describe('email verification', () => {
  it('verifies the email with the code sent at registration', async () => {
    await registerUser('verify@example.com');
    const code = lastEmailCodeTo('verify@example.com');

    const res = await request(app)
      .post('/api/v1/auth/email/verify')
      .send({ email: 'verify@example.com', code });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: 'verify@example.com' } });
    expect(user?.isEmailVerified).toBe(true);
  });
});

describe('logout', () => {
  it('logs out the current device only, leaving other sessions intact', async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    await agentA
      .post('/api/v1/auth/register')
      .send({ email: 'logout@example.com', password: PASSWORD, fullName: 'Test User' });
    const loginB = await agentB
      .post('/api/v1/auth/login')
      .send({ email: 'logout@example.com', password: PASSWORD });
    const tokenB = loginB.body.data.accessToken;

    await agentA.post('/api/v1/auth/logout').send({});

    const refreshA = await agentA.post('/api/v1/auth/refresh').send({});
    expect(refreshA.status).toBe(401);

    const sessionsB = await agentB
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(sessionsB.body.data.sessions).toHaveLength(1);
  });

  it('logs out of all devices', async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    const regRes = await agentA
      .post('/api/v1/auth/register')
      .send({ email: 'logoutall@example.com', password: PASSWORD, fullName: 'Test User' });
    const tokenA = regRes.body.data.accessToken;
    await agentB
      .post('/api/v1/auth/login')
      .send({ email: 'logoutall@example.com', password: PASSWORD });

    const res = await agentA
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.sessionsRevoked).toBe(2);

    const refreshB = await agentB.post('/api/v1/auth/refresh').send({});
    expect(refreshB.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const regRes = await registerUser('me@example.com');
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${regRes.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('me@example.com');
  });
});

describe('DELETE /api/v1/auth/sessions/:id', () => {
  it('lets a user revoke one of their own other sessions', async () => {
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    const regRes = await agentA
      .post('/api/v1/auth/register')
      .send({ email: 'revoke@example.com', password: PASSWORD, fullName: 'Test User' });
    const tokenA = regRes.body.data.accessToken;
    await agentB
      .post('/api/v1/auth/login')
      .send({ email: 'revoke@example.com', password: PASSWORD });

    const sessionsRes = await agentA
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${tokenA}`);
    const otherSession = sessionsRes.body.data.sessions.find(
      (s: { isCurrent: boolean }) => !s.isCurrent,
    );
    expect(otherSession).toBeTruthy();

    const revokeRes = await agentA
      .delete(`/api/v1/auth/sessions/${otherSession.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(revokeRes.status).toBe(200);

    const refreshB = await agentB.post('/api/v1/auth/refresh').send({});
    expect(refreshB.status).toBe(401);
  });

  it("cannot revoke another user's session", async () => {
    const victimReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'victim@example.com', password: PASSWORD, fullName: 'Test User' });
    const victimToken = victimReg.body.data.accessToken;

    const victimSessions = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${victimToken}`);
    const victimSessionId = victimSessions.body.data.sessions[0].id;

    const attackerReg = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'attacker@example.com', password: PASSWORD, fullName: 'Test User' });

    const res = await request(app)
      .delete(`/api/v1/auth/sessions/${victimSessionId}`)
      .set('Authorization', `Bearer ${attackerReg.body.data.accessToken}`);
    expect(res.status).toBe(401);

    const stillActive = await request(app)
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${victimToken}`);
    expect(stillActive.body.data.sessions).toHaveLength(1);
  });
});
