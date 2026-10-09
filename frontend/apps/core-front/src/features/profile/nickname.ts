/**
 * 입력한 닉네임이 지금 쓰는 닉네임과 같은가 — 앞뒤 공백과 대소문자는 무시한다.
 * 같으면 중복 확인을 서버에 묻지 않는다. 확인 API 는 자기 닉네임도 "사용 중" 이라 답한다.
 */
export function isSameNickname(input: string, current: string | null | undefined): boolean {
  if (!current) return false;
  return input.trim().toLowerCase() === current.trim().toLowerCase();
}
