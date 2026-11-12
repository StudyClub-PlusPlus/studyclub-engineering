import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OnboardingPage from './page';
import { ApiError } from '@/lib/http';

const mocks = vi.hoisted(() => ({ complete: vi.fn(), availability: vi.fn(), replace: vi.fn(), setUser: vi.fn() }));
const router = { replace: mocks.replace };
vi.mock('next/navigation', () => ({
  useParams: () => ({ locale: 'ko' }),
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/onboarding/repository', () => ({ completeOnboarding: mocks.complete }));
vi.mock('@/features/profile/nickname-repository', () => ({ checkNicknameAvailability: mocks.availability }));
vi.mock('@/lib/analytics', () => ({ track: vi.fn(), trackSignUp: vi.fn(), readGaClientId: () => undefined }));
vi.mock('@/features/auth/auth', () => ({
  getUser: () => ({ id: 1 }),
  getSuggestedNickname: () => null,
  setSuggestedNickname: vi.fn(),
  getLoginMethod: () => 'google',
  setUser: mocks.setUser,
  logout: vi.fn(),
}));
vi.mock('@/features/onboarding/OnboardingDiscord', () => ({ OnboardingDiscord: () => null }));

const draft = {
  nickname: '테스터',
  timeZone: 'Asia/Seoul',
  termsOfServiceAgreed: true,
  privacyPolicyAgreed: true,
  marketingAgreed: false,
};
const draftKey = 'sc_onboarding_draft_1';

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  sessionStorage.setItem(draftKey, JSON.stringify(draft));
  mocks.availability.mockResolvedValue({ available: true });
});
afterEach(cleanup);

async function readyForm() {
  render(<OnboardingPage />);
  await screen.findByText('사용할 수 있는 닉네임입니다');
  expect(screen.getByRole('checkbox', { name: '만 14세 이상입니다' })).not.toBeChecked();
  expect(screen.getByRole('button', { name: '가입 완료' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: '만 14세 이상입니다' }));
  return screen.getByRole('form', { name: '회원가입 정보' });
}

describe('onboarding form', () => {
  it('submits restored values and removes the draft after successful completion', async () => {
    mocks.complete.mockResolvedValue({ id: 1, nickname: '테스터', timeZone: 'Asia/Seoul' });
    const form = await readyForm();
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
    expect(mocks.complete).toHaveBeenCalledWith(expect.objectContaining({ ...draft, age14Confirmed: true }));
    expect(sessionStorage.getItem(draftKey)).toBeNull();
  });

  it('blocks submission when the asynchronous nickname check reports a conflict', async () => {
    mocks.availability.mockResolvedValue({ available: false });
    render(<OnboardingPage />);
    await screen.findByText('이미 사용중인 닉네임입니다');
    fireEvent.click(screen.getByRole('checkbox', { name: '만 14세 이상입니다' }));
    fireEvent.submit(screen.getByRole('form', { name: '회원가입 정보' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '가입 완료' })).toBeDisabled());
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('retains inputs after a server failure and does not duplicate a pending submission', async () => {
    let reject!: (reason: unknown) => void;
    mocks.complete.mockImplementation(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const form = await readyForm();
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    reject(new ApiError(500, 'failure'));
    await screen.findByText('저장하지 못했어요. 입력한 내용은 유지됐으니 다시 시도해 주세요.');
    expect(screen.getByRole('textbox', { name: /닉네임/ })).toHaveValue('테스터');
    expect(JSON.parse(sessionStorage.getItem(draftKey)!)).toEqual(draft);
    expect(screen.getByRole('checkbox', { name: '만 14세 이상입니다' })).toBeChecked();
  });
});
