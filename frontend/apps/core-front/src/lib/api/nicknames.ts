import { apiJson } from './client';

export type NicknameAvailability = { available: boolean };

/** 형식이 맞은 닉네임만 호출한다. 형식 오류는 400. */
export function checkNicknameAvailability(
  value: string,
  signal?: AbortSignal,
): Promise<NicknameAvailability> {
  const qs = new URLSearchParams({ value });
  return apiJson<NicknameAvailability>(`/api/nicknames/availability?${qs.toString()}`, {
    method: 'GET',
    signal,
  });
}
