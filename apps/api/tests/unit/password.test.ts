import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/password.js';

describe('password utils', () => {
  it('hashes a password and verifies the original against it', async () => {
    const hash = await hashPassword('Sup3rSecret!');
    expect(hash).not.toBe('Sup3rSecret!');
    await expect(verifyPassword('Sup3rSecret!', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Sup3rSecret!');
    await expect(verifyPassword('WrongPassword!', hash)).resolves.toBe(false);
  });
});
