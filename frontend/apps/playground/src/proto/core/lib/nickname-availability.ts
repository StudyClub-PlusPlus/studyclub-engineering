/**
 * 닉네임 중복 검사 — 프로토.
 *
 * **저장은 입력한 그대로, 비교는 정규화한 값으로 한다.** 앞뒤 공백을 떼고 유니코드 NFC 로 맞춘 뒤
 * 소문자로 내린다. NFC 가 없으면 한글 조합형·완성형이 눈에 같아 보이는데도 다른 값으로 저장되어,
 * 같은 이름이 둘 생긴다. 대소문자도 구분하지 않는다 — `Journey` 와 `journey` 는 같은 이름이다.
 *
 * TODO(api): `GET /api/nicknames/availability?value={raw}` 로 교체한다. 지금은 화면에서만 판정한다.
 */

export function normalizeNickname(raw: string): string {
  return raw.trim().normalize('NFC').toLocaleLowerCase();
}

/** 이미 쓰이고 있는 이름 (프로토용). 실제 판정은 서버의 UNIQUE 인덱스가 한다. */
const TAKEN = ['studyclub', 'journey', '운영진', 'admin'].map(normalizeNickname);

export type Availability = { available: boolean };

/**
 * 검사 한 번. `signal` 로 취소할 수 있다 — 늦게 도착한 과거 응답이 최신 상태를 덮어쓰면 안 된다.
 *
 * 지연을 넣는 이유는 **확인 중 상태가 실제로 보이게** 하기 위해서다. 서버가 붙으면 사라진다.
 */
export function checkNicknameAvailability(raw: string, signal?: AbortSignal): Promise<Availability> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve({ available: !TAKEN.includes(normalizeNickname(raw)) });
    }, 450);
    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
