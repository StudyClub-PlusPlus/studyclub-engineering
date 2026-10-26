/** 백오피스는 기본적으로 실제 API를 사용한다. UI 단독 개발 시에만 명시적으로 켠다. */
export function isMockApiEnabled() {
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
}
