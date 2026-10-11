/**
 * 이메일 가리기 (POL-0007).
 *
 * 아이디 첫 글자만 남기고 가린다. **도메인은 남긴다** — 어느 메일을 쓰는지는 운영에 쓸모가 있고,
 * 사람을 가리키는 것은 아이디 쪽이다.
 *
 * 목록은 가린 채로 두고 필요한 줄만 한 번씩 펼친다. 늘 펼쳐 두면 화면을 띄운 채 자리를 비우거나
 * 화면을 공유할 때 수십 명의 주소가 그대로 드러난다.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  return `${email[0]}***${email.slice(at)}`;
}
