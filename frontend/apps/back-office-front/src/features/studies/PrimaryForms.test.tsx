import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_EVENT } from '@/features/events/EventForm';
import { eventFormSchema } from '@/features/events/form-schema';
import { discordLinkSchema } from '@/features/studies/discord-link-schema';
import { EMPTY_FORM } from '@/features/studies/form-schema';
import { useStudyForm } from '@/features/studies/StudyForm';

const valid = { ...EMPTY_FORM, title: '스터디', summary: '소개', category: 'DATA', deadline: '2026-11-01' };

describe('스터디 RHF 상태', () => {
  it('검증 실패는 제출하지 않고 프로그램 기본값과 업로드 값을 제출한다', async () => {
    const { result } = renderHook(() => useStudyForm(EMPTY_FORM));
    const submit = vi.fn();
    await act(async () => {
      await result.current.handleSubmit(submit)();
    });
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.errors.title).toBe('제목을 입력하세요.');
    const uploaded = { ...valid, thumbnailFileId: 17, thumbnailUrl: 'https://cdn.test/image.jpg' };
    act(() => result.current.change(uploaded));
    expect(result.current.formState.isDirty).toBe(true);
    await act(async () => {
      await result.current.handleSubmit(submit)();
    });
    expect(submit.mock.calls[0][0]).toEqual(uploaded);
  });

  it('서버 오류는 입력을 보존하고 reset은 dirty와 오류를 지운다', () => {
    const { result } = renderHook(() => useStudyForm(valid));
    act(() => result.current.change({ ...valid, title: '수정' }));
    act(() => result.current.setServerErrors({ title: '수정할 수 없습니다.' }));
    expect(result.current.value.title).toBe('수정');
    expect(result.current.errors.title).toBe('수정할 수 없습니다.');
    act(() => result.current.reset(valid));
    expect(result.current.value).toEqual(valid);
    expect(result.current.formState.isDirty).toBe(false);
    expect(result.current.errors).toEqual({});
  });
});

describe('행사·디스코드 스키마', () => {
  it('행사의 필수 입력만 검증하고 선택 링크는 기존대로 허용한다', () => {
    expect(eventFormSchema.safeParse(EMPTY_EVENT).success).toBe(false);
    const validEvent = {
      ...EMPTY_EVENT,
      title: '행사',
      summary: '소개',
      type: 'talk',
      date: '2026-11-01',
      link: '외부 신청 링크',
    };
    expect(eventFormSchema.safeParse(validEvent).success).toBe(true);
    expect(eventFormSchema.safeParse({ ...validEvent, title: '  ' }).success).toBe(false);
  });

  it('디스코드 이름은 공백 제거 후 필수·96자 제한을 검증한다', () => {
    expect(discordLinkSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(discordLinkSchema.parse({ name: ' 이름 ' })).toEqual({ name: '이름' });
    expect(discordLinkSchema.safeParse({ name: ' ' + '가'.repeat(96) + ' ' }).success).toBe(true);
    expect(discordLinkSchema.safeParse({ name: '가'.repeat(97) }).success).toBe(false);
  });
});

it.each(['create', 'edit'] as const)('%s blocks overlong values on submission while preserving the draft', async (mode) => {
  const initial = mode === 'edit' ? { ...valid, programMode: 'existing' as const, programId: '1' } : valid;
  const { result } = renderHook(() => useStudyForm(initial));
  const submit = vi.fn();
  const draft = { ...initial, title: '가'.repeat(61), summary: '나'.repeat(256), discordUrl: 'https://example.com/' + 'a'.repeat(2048), driveUrl: 'https://example.com/' + 'b'.repeat(2048) };
  act(() => result.current.change(draft));
  await act(async () => { await result.current.handleSubmit(submit)(); });
  expect(submit).not.toHaveBeenCalled();
  expect(result.current.errors).toMatchObject({ title: '60자 이내로 입력하세요.', summary: '255자 이내로 입력하세요.', discordUrl: '2048자 이내로 입력하세요.', driveUrl: '2048자 이내로 입력하세요.' });
  expect(result.current.value).toEqual(draft);
});

it.each(['title', 'summary', 'discordUrl', 'driveUrl'] as const)('blocks %s independently of other valid fields', async (field) => {
  const { result } = renderHook(() => useStudyForm(valid));
  const submit = vi.fn();
  const invalid = field === 'title' ? '가'.repeat(61) : field === 'summary' ? '나'.repeat(256) : 'https://example.com/' + 'a'.repeat(2048);
  act(() => result.current.change({ ...valid, [field]: invalid }));
  await act(async () => { await result.current.handleSubmit(submit)(); });
  expect(submit).not.toHaveBeenCalled();
  expect(result.current.errors[field]).toBeDefined();
});

it('accepts exactly the server limits for trimmed submission values', async () => {
  const url = 'https://example.com/' + 'a'.repeat(2048 - 'https://example.com/'.length);
  const draft = { ...valid, title: '가'.repeat(60), summary: '나'.repeat(255), discordUrl: url, driveUrl: url };
  const { result } = renderHook(() => useStudyForm(draft));
  const submit = vi.fn();
  await act(async () => { await result.current.handleSubmit(submit)(); });
  expect(submit).toHaveBeenCalledOnce();
  expect(result.current.errors).toEqual({});
});
