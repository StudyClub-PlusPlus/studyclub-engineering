'use client';

import { useRef, useState, type ChangeEvent } from 'react';

/**
 * 이미지 올리기 공용 — 파일 고르기 · 브라우저 검사 · 올리는 중 잠금 · 오류 문구.
 * 사용자 사이트와 운영자 콘솔이 같이 쓴다. 문서: docs/file-upload.md
 *
 * 서버 호출은 앱이 넘긴다 (`upload`) — 앱마다 http 클라이언트가 따로라 여기서 fetch 하지 않는다.
 * 서버가 형식·크기를 다시 검사하지만, 안 맞는 파일을 5MB 까지 보내고 나서 알려 주면 느리다 — 고른 직후 거른다.
 */

/** 서버가 받는 형식 셋. 숨긴 파일 입력의 accept 와 고른 뒤 검사가 같은 목록을 쓴다. */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPE_ERROR = 'jpeg, png, webp 파일만 올릴 수 있습니다';
export const IMAGE_SIZE_ERROR = '5MB 이하 파일만 올릴 수 있습니다';

/** 서버 `StoragePurpose`. 새 용도는 백엔드 enum 에 먼저 추가한다. */
export type ImagePurpose = 'PROFILE' | 'STUDY_THUMBNAIL';

/** POST /api/uploads/images 응답. `fileId` 는 기능 쪽 저장 API 에 넘기고, `url` 은 미리보기용이다. */
export type UploadedImage = { fileId: number; url: string };

/** 보내기 전에 거를 사유. 없으면 null. `file.type` 은 확장자에서 온 값이라 형식의 진본은 서버다. */
export function imageFileProblem(file: { type: string; size: number }): string | null {
  if (!IMAGE_ACCEPT.split(',').includes(file.type)) return IMAGE_TYPE_ERROR;
  if (file.size > IMAGE_MAX_BYTES) return IMAGE_SIZE_ERROR;
  return null;
}

/** POST /api/uploads/images 의 본문. `Content-Type` 은 넣지 않는다 — 브라우저가 multipart 경계와 함께 붙인다. */
export function imageUploadForm(file: File, purpose: ImagePurpose): FormData {
  const body = new FormData();
  body.append('file', file);
  body.append('purpose', purpose);
  return body;
}

export type UseImageUploadOptions = {
  purpose: ImagePurpose;
  /** 앱의 http 로 POST /api/uploads/images. 예: `(body) => http('/api/uploads/images', { method: 'POST', body })` */
  upload: (body: FormData) => Promise<UploadedImage>;
  /** 올린 뒤 할 일 — 프로필 연결처럼 바로 저장하거나, 폼 값에 fileId 를 넣는다. 끝날 때까지 잠금이 유지된다. */
  onUploaded: (uploaded: UploadedImage) => Promise<void> | void;
  /** 실패를 문구로. null 을 돌려주면 앱이 직접 처리한 것(재로그인·이동 등)으로 보고 문구를 띄우지 않는다. 없으면 `err.message`. */
  onError?: (err: unknown) => string | null;
};

/**
 * 쓰는 법: `<input type='file' hidden {...inputProps} />` 를 두고 버튼에서 `pick()`.
 * 같은 파일을 다시 골라도 change 가 나도록 고른 직후 입력값을 비운다.
 */
export function useImageUpload({ purpose, upload, onUploaded, onError }: UseImageUploadOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    const problem = imageFileProblem(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await onUploaded(await upload(imageUploadForm(file, purpose)));
    } catch (err) {
      const message = onError ? onError(err) : err instanceof Error ? err.message : null;
      if (message) setError(message);
    } finally {
      setUploading(false);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void uploadFile(file);
  }

  return {
    /** 숨긴 파일 입력에 펼친다. */
    inputProps: { ref: inputRef, type: 'file' as const, accept: IMAGE_ACCEPT, onChange },
    /** 파일 고르기 창을 연다. */
    pick: () => inputRef.current?.click(),
    /** 고른 파일을 직접 넘길 때 (끌어다 놓기 등). */
    uploadFile,
    isUploading,
    error,
    setError,
  };
}
