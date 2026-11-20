import { browserLoginResponseSchema } from './response-schema';

/** Same-origin exchange sets httpOnly cookies; only validated account data reaches session state. */
export async function exchangeSocialLogin(input: {
  code: string;
  provider: 'google' | 'apple';
  redirectUri?: string;
  name?: string;
}) {
  const response = await fetch('/api/auth/social/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { ok: false as const, status: response.status, body };
  return { ok: true as const, data: browserLoginResponseSchema.parse(body) };
}
