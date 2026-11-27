import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IMAGE_FAILED_MESSAGE, RetryableImage } from './RetryableImage';

const SRC = 'https://api.example.test/api/me/feedbacks/6/images/2';

function renderImage() {
  render(<RetryableImage src={SRC} alt='첨부 이미지 1' className='h-24 w-36' />);
  return screen.getByRole('img', { name: '첨부 이미지 1' });
}

afterEach(() => vi.unstubAllGlobals());

describe('RetryableImage', () => {
  it('처음에는 쿠키를 싣는 이미지로 그린다', () => {
    const img = renderImage();
    expect(img).toHaveAttribute('src', SRC);
    expect(img).toHaveAttribute('crossorigin', 'use-credentials');
  });

  it('실패하면 인증을 한 번 갱신하고 같은 주소를 다시 요청한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const img = renderImage();

    fireEvent.error(img);

    await waitFor(() => expect(img).toHaveAttribute('src', `${SRC}?retry=1`));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', { method: 'POST' });
  });

  it('다시 요청해도 실패하면 안내 문구를 보이고 갱신은 더 하지 않는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const img = renderImage();
    fireEvent.error(img);
    await waitFor(() => expect(img).toHaveAttribute('src', `${SRC}?retry=1`));

    fireEvent.error(img);

    expect(await screen.findByText(IMAGE_FAILED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('인증 갱신이 거절되면 다시 요청하지 않고 안내 문구를 보인다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const img = renderImage();

    fireEvent.error(img);

    expect(await screen.findByText(IMAGE_FAILED_MESSAGE)).toBeInTheDocument();
    expect(img).not.toHaveAttribute('src', `${SRC}?retry=1`);
  });

  it('인증 갱신 요청 자체가 실패해도 안내 문구를 보인다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const img = renderImage();

    fireEvent.error(img);

    expect(await screen.findByText(IMAGE_FAILED_MESSAGE)).toBeInTheDocument();
  });

  it('갱신하는 동안 오류가 또 나도 갱신 요청은 한 번이다', async () => {
    let finish: (value: { ok: boolean }) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const img = renderImage();

    fireEvent.error(img);
    fireEvent.error(img);
    finish({ ok: true });

    await waitFor(() => expect(img).toHaveAttribute('src', `${SRC}?retry=1`));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
