// 이미지 올리기 — 서버 호출 한 줄. 고르기·검사·잠금은 @studyclub/ui 의 useImageUpload 가 한다 (docs/file-upload.md).
import type { UploadedImage } from '@studyclub/ui';

import { http } from './http'; // 상대 경로 — vitest 에 @ 별칭이 없다 (features/feedback 테스트가 이 파일을 부른다)

/** POST /api/uploads/images — 파일을 먼저 올려 번호를 받는다. 어디에 쓸지는 기능 쪽 저장 API 가 정한다. */
export function uploadImage(body: FormData): Promise<UploadedImage> {
  return http<UploadedImage>('/api/uploads/images', { method: 'POST', body });
}
