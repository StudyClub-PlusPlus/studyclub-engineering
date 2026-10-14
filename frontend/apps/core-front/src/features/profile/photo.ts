// 프로필 사진 — 고른 직후 브라우저에서 거르는 규칙. 서버가 다시 검사하지만, 안 맞는 파일을 5MB 까지 올려 보내고 나서 알려 주는 건 느리다.

/** 서버가 받는 형식 셋. 숨긴 파일 입력의 accept 와 고른 뒤 검사가 같은 목록을 쓴다. */
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const PHOTO_TYPE_ERROR = 'jpeg, png, webp 파일만 올릴 수 있습니다';
export const PHOTO_SIZE_ERROR = '5MB 이하 파일만 올릴 수 있습니다';

/** 보내기 전에 거를 사유. 없으면 null. `file.type` 은 확장자에서 온 값이라 형식 검사의 진본은 서버다. */
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!PHOTO_ACCEPT.split(',').includes(file.type)) return PHOTO_TYPE_ERROR;
  if (file.size > PHOTO_MAX_BYTES) return PHOTO_SIZE_ERROR;
  return null;
}

/** 사진이 없을 때 동그라미에 넣는 글자 — 닉네임 첫 글자. 비어 있으면 이메일 첫 글자. */
export function initialOf(name: string | null | undefined, fallback: string): string {
  const source = (name ?? '').trim() || fallback;
  return source.charAt(0).toUpperCase();
}
