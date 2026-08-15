const FORBIDDEN_KEYS = new Set([
  'patientId',
  'patientName',
  'patient',
  'phone',
  'email',
  'fullName',
]);

/** Recursively scans a JSON-shaped value for keys that would indicate patient/staff identity
 * leaking into a public response. Used by privacy tests on public catalog endpoints. */
export function findForbiddenKeys(value: unknown, path = ''): string[] {
  if (value === null || typeof value !== 'object') return [];

  const found: string[] = [];
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      found.push(...findForbiddenKeys(item, `${path}[${i}]`));
    }
    return found;
  }

  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) {
      found.push(currentPath);
    }
    found.push(...findForbiddenKeys(val, currentPath));
  }
  return found;
}

/** Asserts a raw response body (already JSON) contains none of the given identifying substrings
 * (e.g. a fixture patient's name/email) anywhere in its serialized form. */
export function assertNoSubstrings(body: unknown, substrings: string[]): void {
  const json = JSON.stringify(body);
  for (const s of substrings) {
    if (json.includes(s)) {
      throw new Error(`Forbidden identifying substring "${s}" found in response body`);
    }
  }
}
