import { describe, expect, it } from 'vitest';

import {
  CONTENT_MAX,
  IMAGE_MAX_BYTES,
  IMAGE_SIZE_ERROR,
  IMAGE_TYPE_ERROR,
  SEND_FAILED_MESSAGE,
  TITLE_MAX,
  TOO_MANY_MESSAGE,
  feedbackImageForm,
  feedbackSchema,
  imageProblem,
  sendErrorMessage,
  toSubmitBody,
  uploadErrorMessage,
  viewportOf,
} from './feedback';
import { ApiError } from '../../lib/http';

function messages(values: { type: string; title: string; content: string }) {
  const result = feedbackSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));
}

const valid = { type: 'BUG', title: '출석 버튼', content: '아이폰에서 출석 버튼이 안 눌려요.' };

describe('feedbackSchema', () => {
  it('유형은 기본 선택이 없다 — 고르지 않으면 사유를 낸다', () => {
    expect(messages({ ...valid, type: '' })).toEqual({ type: '유형을 선택해 주세요.' });
    expect(messages({ ...valid, type: 'OTHER' })).toEqual({ type: '유형을 선택해 주세요.' });
  });

  it('세 유형은 통과한다', () => {
    for (const type of ['QUESTION', 'IDEA', 'BUG']) expect(messages({ ...valid, type })).toEqual({});
  });

  it('제목은 앞뒤 공백을 자른 뒤 2~100자', () => {
    expect(messages({ ...valid, title: ' a ' })).toEqual({ title: '제목을 2자 이상 입력해 주세요.' });
    expect(messages({ ...valid, title: '  ab  ' })).toEqual({});
    expect(messages({ ...valid, title: 'a'.repeat(TITLE_MAX) })).toEqual({});
    expect(messages({ ...valid, title: 'a'.repeat(TITLE_MAX + 1) })).toEqual({
      title: '제목은 100자를 넘을 수 없습니다.',
    });
  });

  it('내용은 앞뒤 공백을 자른 뒤 10~2000자', () => {
    expect(messages({ ...valid, content: '   123456789   ' })).toEqual({ content: '내용을 10자 이상 입력해 주세요.' });
    expect(messages({ ...valid, content: '\n1234567890\n' })).toEqual({});
    expect(messages({ ...valid, content: 'a'.repeat(CONTENT_MAX + 1) })).toEqual({
      content: '내용은 2000자를 넘을 수 없습니다.',
    });
  });

  it('빈 폼은 세 칸 모두 사유를 낸다', () => {
    expect(Object.keys(messages({ type: '', title: '', content: '' })).sort()).toEqual(['content', 'title', 'type']);
  });
});

describe('toSubmitBody', () => {
  it('제목은 자르고 내용은 쓴 그대로, 이미지 번호와 화면 크기를 싣는다', () => {
    const body = toSubmitBody(
      { type: 'QUESTION', title: '  클럽과 스터디  ', content: '  첫 줄\n둘째 줄  ' },
      [812, 813],
      { width: 390, height: 844 },
    );
    expect(body).toEqual({
      type: 'QUESTION',
      title: '클럽과 스터디',
      content: '  첫 줄\n둘째 줄  ',
      imageFileIds: [812, 813],
      viewport: { width: 390, height: 844 },
    });
  });
});

describe('viewportOf', () => {
  it('innerWidth · innerHeight 를 서버 범위(1~10000) 정수로', () => {
    expect(viewportOf({ innerWidth: 1440, innerHeight: 900 })).toEqual({ width: 1440, height: 900 });
    expect(viewportOf({ innerWidth: 390.6, innerHeight: 0 })).toEqual({ width: 391, height: 1 });
    expect(viewportOf({ innerWidth: 20000, innerHeight: Number.NaN })).toEqual({ width: 10000, height: 1 });
  });
});

describe('imageProblem', () => {
  it('PNG · JPG · WEBP 만 받는다 (GIF 제외)', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) expect(imageProblem({ type, size: 1024 })).toBeNull();
    expect(imageProblem({ type: 'image/gif', size: 1024 })).toBe(IMAGE_TYPE_ERROR);
    expect(imageProblem({ type: '', size: 1024 })).toBe(IMAGE_TYPE_ERROR);
  });

  it('장당 5MB 까지', () => {
    expect(imageProblem({ type: 'image/png', size: IMAGE_MAX_BYTES })).toBeNull();
    expect(imageProblem({ type: 'image/png', size: IMAGE_MAX_BYTES + 1 })).toBe(IMAGE_SIZE_ERROR);
  });
});

describe('feedbackImageForm', () => {
  it('용도를 FEEDBACK 으로 싣는다', () => {
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const form = feedbackImageForm(file);
    expect(form.get('purpose')).toBe('FEEDBACK');
    expect((form.get('file') as File).name).toBe('shot.png');
  });
});

describe('sendErrorMessage', () => {
  it('429 는 「잠시 후 다시 시도해 주세요.」', () => {
    expect(sendErrorMessage(new ApiError(429, '잠시 후 다시 시도해 주세요.'))).toBe(TOO_MANY_MESSAGE);
  });

  it('400 · 5xx · 네트워크 오류는 하나의 문구', () => {
    expect(sendErrorMessage(new ApiError(400, '입력값이 올바르지 않습니다.'))).toBe(SEND_FAILED_MESSAGE);
    expect(sendErrorMessage(new ApiError(500, 'boom'))).toBe(SEND_FAILED_MESSAGE);
    expect(sendErrorMessage(new TypeError('Failed to fetch'))).toBe(SEND_FAILED_MESSAGE);
  });
});

describe('uploadErrorMessage', () => {
  it('400 은 서버 사유를 그대로, 413 은 크기 안내, 나머지는 다시 시도', () => {
    expect(uploadErrorMessage(new ApiError(400, '업로드한 사진이 너무 많습니다.'))).toBe(
      '업로드한 사진이 너무 많습니다.',
    );
    expect(uploadErrorMessage(new ApiError(413, '요청에 실패했습니다 (413)'))).toBe(IMAGE_SIZE_ERROR);
    expect(uploadErrorMessage(new ApiError(500, 'boom'))).toBe('이미지를 올리지 못했습니다. 다시 시도해 주세요.');
  });
});
