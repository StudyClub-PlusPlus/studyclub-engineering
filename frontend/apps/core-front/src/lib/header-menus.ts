/**
 * 헤더의 펼침 메뉴(아바타 메뉴 · 모바일 메뉴)는 한 번에 하나만 열린다.
 * 하나가 열리면 이 이벤트를 쏘고, 나머지는 받아서 닫는다. 상태를 한곳에 모을 만큼의 일이 아니라 이벤트 하나로 둔다.
 */
const EVENT = 'studyclub:header-menu-open';

export function announceMenuOpen(id: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

/** 다른 메뉴가 열리면 close 를 부른다. 정리 함수를 돌려준다 */
export function closeOnOtherMenu(id: string, close: () => void) {
  const on = (e: Event) => {
    if ((e as CustomEvent<string>).detail !== id) close();
  };
  window.addEventListener(EVENT, on);
  return () => window.removeEventListener(EVENT, on);
}
