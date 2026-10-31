import type { ProfilePayload } from './types';
import { accountSchema } from '@/features/account/response-schema';
import { marketingConsentSchema } from '@/features/profile/response-schema';
import { http } from '@/lib/http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const fetchAccount = () => http('/api/me', accountSchema);
export const updateProfile = (payload: ProfilePayload) =>
  http('/api/me', accountSchema, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
export const attachProfileImage = (fileId: number) =>
  http('/api/me/profile-image', accountSchema, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ fileId }),
  });
export const removeProfileImage = () => http('/api/me/profile-image', accountSchema, { method: 'DELETE' });
export const fetchMarketingConsent = () => http('/api/me/marketing-consent', marketingConsentSchema);
export const changeMarketingConsent = (agreed: boolean) =>
  http('/api/me/marketing-consent', marketingConsentSchema, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ agreed }),
  });
