import { adminStatsHandlers } from '@studyclub/mock/msw/handlers';
import { describe, expect, it } from 'vitest';

async function preview(path: string, query: string) {
  const handler = adminStatsHandlers.handlers.find((item) => item.path.endsWith(path))!;
  const response = handler.presets[0].response;
  if (typeof response !== 'function') throw new Error('예시 응답 함수가 필요합니다.');
  return response({ request: new Request(`https://example.test/api/admin/stats${path}?${query}`), params: {} });
}

describe('대시보드 API mock 계약', () => {
  it.each([
    ['/summary', ''],
    ['/study-board', 'view=ONGOING&'],
    ['/study-board', 'view=RECRUITMENT&'],
    ['/attendance-trend', 'weeks=12&'],
  ])('%s 예시도 브라우저보다 mock 회원의 서울 프로필을 우선한다', async (path, query) => {
    expect(await preview(path, `${query}timeZone=America%2FToronto`)).toHaveProperty('timeZone', 'Asia/Seoul');
  });

  it.each(['', 'Not/AZone'])('명시한 무효 Query %s는 프로필이 있어도 400이다', async (zone) => {
    const response = await preview('/summary', `timeZone=${zone}`);
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
  });
});
