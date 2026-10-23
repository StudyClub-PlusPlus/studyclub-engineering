/**
 * 회원의 디스코드 계정.
 *
 * **스터디 진행이 디스코드에서 이뤄진다.** 계정이 이어져 있지 않은 사람은 승인해도 합류할 수 없고,
 * 권한을 올려도 디스코드 역할은 따라가지 않는다. 그래서 명단에서 그 사실이 보여야 한다.
 *
 * 보여주는 것은 **핸들(@아이디)** 이다. 신청서에 적어 낸 **서버 별명**(`discordNickname`)과 다른
 * 값이다 — 별명은 본인이 타이핑한 글자라 틀릴 수 있고 바뀌기도 하지만, 핸들은 계정 그 자체다.
 * 디스코드에서 그 사람을 찾아야 할 때 믿을 수 있는 쪽은 핸들이다.
 *
 * 프로토는 계정 데이터가 없어 **이메일로 정한다** — 다섯에 하나꼴로 미연동이고, 같은 사람은 늘 같다.
 * 난수를 쓰면 새로고침마다 명단이 달라져 화면을 판단할 수 없다.
 *
 * TODO(api): 목록 응답(`AccountView`)에 `discordHandle` 을 더해 달라 — 지금은 내려오지 않는다.
 * DB 에는 이미 있다(`USERS.DISCORD_ID` · `USERS.DISCORD_HANDLE`).
 */
export function discordHandle(email: string): string | null {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  if (Math.abs(h) % 5 === 0) return null;
  // 이메일 아이디를 바탕으로 만들되 그대로 쓰지는 않는다 — 둘이 늘 같지는 않다
  const local = email.slice(0, email.indexOf('@')).toLowerCase().replace(/[^a-z0-9]/g, '');
  return Math.abs(h) % 3 === 0 ? `${local}_dev` : local;
}
