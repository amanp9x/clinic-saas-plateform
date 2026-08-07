const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type IdentifierType = 'email' | 'phone';

export function identifierType(identifier: string): IdentifierType {
  return EMAIL_REGEX.test(identifier) ? 'email' : 'phone';
}
