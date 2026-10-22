/**
 * 회원의 디스코드 연동 여부.
 *
 * **스터디 진행이 디스코드에서 이뤄진다.** 연동이 안 된 사람은 승인해도 합류할 수 없고,
 * 권한을 올려도 디스코드 역할은 따라가지 않는다 ([POL-0009] 가 아니라 운영의 일이다).
 * 그래서 명단에서 그 사실이 보여야 한다.
 *
 * 프로토는 계정 데이터가 없어 **이메일로 정한다** — 다섯에 하나꼴로 미연동이고, 같은 사람은
 * 늘 같다. 난수를 쓰면 새로고침마다 명단이 달라져 화면을 판단할 수 없다.
 *
 * TODO(api): GET /api/users — `discordLinked`(또는 `discordId` 유무)를 함께 내려준다.
 */
export function discordLinked(email: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 5 !== 0;
}
