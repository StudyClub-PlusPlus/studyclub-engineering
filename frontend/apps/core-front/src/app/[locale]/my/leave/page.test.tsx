import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LeavePage from './page';

const mocks = vi.hoisted(() => ({ studies: vi.fn(), deleteAccount: vi.fn(), replace: vi.fn(), push: vi.fn() }));
const router = { replace: mocks.replace, push: mocks.push };
vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'ko' }), useRouter: () => router }));
vi.mock('@/features/account/repository', () => ({ getLeaveStudies: mocks.studies }));
vi.mock('@/features/auth/auth', () => ({ getUser: () => ({ id: 1 }), deleteAccount: mocks.deleteAccount }));
vi.mock('@/features/account/local-state', () => ({ clearMyLocalData: vi.fn() }));

const crewStudies = [
  { studyId: 11, title: '함께 읽는 스터디' },
  { studyId: 12, title: '알고리즘 연습' },
];
const navigatorStudies = [{ studyId: 21, title: '직접 이끄는 스터디' }];

beforeEach(() => {
  vi.resetAllMocks();
  // 실제 탈퇴·화면 이동 없이 요청 여부만 검증한다.
  mocks.deleteAccount.mockResolvedValue({ ok: false, errorMessage: '테스트 오류' });
});
afterEach(cleanup);

describe('withdrawal study guidance', () => {
  it.each([
    { name: 'crew only', crew: crewStudies, navigator: [] },
    { name: 'navigator only', crew: [], navigator: navigatorStudies },
    { name: 'both roles', crew: crewStudies, navigator: navigatorStudies },
    { name: 'no studies', crew: [], navigator: [] },
  ])('shows only the relevant lists for $name', async ({ crew, navigator }) => {
    mocks.studies.mockResolvedValue({ status: 'ok', crewStudies: crew, navigatorStudies: navigator });
    render(<LeavePage />);
    await screen.findByRole('heading', { name: '회원 탈퇴' });

    if (crew.length) {
      const notice = screen.getByRole('region', { name: `크루로 참여 중인 스터디 ${crew.length}개` });
      expect(within(notice).getAllByRole('listitem')).toHaveLength(crew.length);
      crew.forEach((study) => expect(within(notice).getByText(study.title)).toBeInTheDocument());
      expect(
        within(notice).getByText('담당 네비게이터에게 탈퇴 사실을 알리고, 참여 중단을 요청해 주시기 바랍니다.'),
      ).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('region', { name: /크루로 참여 중인 스터디/ })).not.toBeInTheDocument();
    }
    if (navigator.length) {
      const notice = screen.getByRole('region', { name: `네비게이터로 맡은 스터디 ${navigator.length}개` });
      expect(within(notice).getAllByRole('listitem')).toHaveLength(navigator.length);
      expect(
        within(notice).getByText('담당 캡틴에게 탈퇴 사실을 알리고, 스터디 인계 방법을 상의해 주시기 바랍니다.'),
      ).toBeInTheDocument();
    } else {
      expect(screen.queryByRole('region', { name: /네비게이터로 맡은 스터디/ })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('link', { name: '내 스터디 확인하기' })).not.toBeInTheDocument();
    expect(screen.queryByText('그래도 탈퇴하시겠습니까?')).not.toBeInTheDocument();
  });

  it('keeps the navigator confirmation before sending a withdrawal request', async () => {
    mocks.studies.mockResolvedValue({ status: 'ok', crewStudies, navigatorStudies });
    render(<LeavePage />);
    fireEvent.click(await screen.findByRole('button', { name: '탈퇴하기' }));
    await screen.findByText('그래도 탈퇴하시겠습니까?');
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '탈퇴 취소' }));
    expect(screen.queryByText('그래도 탈퇴하시겠습니까?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '탈퇴하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '탈퇴' }));
    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledWith(null));
  });

  it('does not add a second confirmation for a crew-only member', async () => {
    mocks.studies.mockResolvedValue({ status: 'ok', crewStudies, navigatorStudies: [] });
    render(<LeavePage />);
    fireEvent.click(await screen.findByRole('button', { name: '탈퇴하기' }));
    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledWith(null));
    expect(screen.queryByText('그래도 탈퇴하시겠습니까?')).not.toBeInTheDocument();
  });

  it('blocks withdrawal on a failed lookup and restores guidance after retry', async () => {
    mocks.studies.mockResolvedValueOnce({ status: 'unknown' });
    render(<LeavePage />);
    const leave = await screen.findByRole('button', { name: '탈퇴하기' });
    expect(leave).toBeDisabled();
    expect(screen.getByText('스터디 목록을 확인하지 못했습니다')).toBeInTheDocument();
    fireEvent.click(leave);
    expect(mocks.deleteAccount).not.toHaveBeenCalled();

    let finishCheck!: (value: unknown) => void;
    mocks.studies.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCheck = resolve;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: '다시 확인' }));
    expect(leave).toBeDisabled();
    finishCheck({ status: 'ok', crewStudies, navigatorStudies });
    await screen.findByRole('region', { name: '네비게이터로 맡은 스터디 1개' });
    expect(screen.queryByText('스터디 목록을 확인하지 못했습니다')).not.toBeInTheDocument();
    expect(leave).toBeEnabled();
    fireEvent.click(leave);
    await screen.findByText('그래도 탈퇴하시겠습니까?');
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });
});
