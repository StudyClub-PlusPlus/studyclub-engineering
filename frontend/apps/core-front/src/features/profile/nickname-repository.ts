import { nicknameAvailabilitySchema } from '@/features/profile/response-schema';
import { http } from '@/lib/http';

export type NicknameAvailability = { available: boolean };

/** 형식이 맞은 닉네임만 호출한다. 형식 오류는 400. */
export function checkNicknameAvailability(
  value: string,
  signal?: AbortSignal,
): Promise<NicknameAvailability> {
  const qs = new URLSearchParams({ value });
  return http(`/api/nicknames/availability?${qs.toString()}`, nicknameAvailabilitySchema, {
    method: 'GET',
    signal,
  }, { refreshOnUnauthorized: true });
}
