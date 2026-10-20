// 인증 쿠키 이름 — 의존성 없는 파일. middleware 가 불러도 클라이언트 코드가 딸려 오지 않게 auth.ts 와 따로 둔다.
/**
 * 쿠키 이름에 넣을 환경 이름 — **서버 런타임 env**(`AUTH_COOKIE_ENV`). stage 만 `stage` 를 준다.
 * stage·운영·사이트·백오피스가 같은 상위 도메인에 쿠키를 심어서, 이름이 같으면 서로 덮어쓴다.
 * 운영은 비워 기존 이름(`{prefix}access_token`)을 그대로 쓴다 — 바꾸면 운영 사용자가 전부 로그아웃된다.
 * API(JwtAuthFilter)도 같은 env 로 같은 이름을 읽는다. 브라우저 JS 는 httpOnly 쿠키를 못 읽으므로 이 값을 쓰지 않는다.
 */
const COOKIE_ENV = process.env.AUTH_COOKIE_ENV ? `${process.env.AUTH_COOKIE_ENV}_` : '';

export const ACCESS_COOKIE = `sc_${COOKIE_ENV}access_token`;
export const REFRESH_COOKIE = `sc_${COOKIE_ENV}refresh_token`;
