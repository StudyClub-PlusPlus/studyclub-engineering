import { legacyRedirectUrl } from '@studyclub/utils';
import { describe, expect, it } from 'vitest';


describe('legacyRedirectUrl', () => {
  it('루트·서브도메인·경로·쿼리를 그대로 옮긴다', () => {
    expect(legacyRedirectUrl('studyclub-plusplus.com', '/ko/notices?x=1')).toBe('https://studyclub.life/ko/notices?x=1');
    expect(legacyRedirectUrl('back-office.studyclub-plusplus.com:443', '/login')).toBe('https://back-office.studyclub.life/login');
    expect(legacyRedirectUrl('STAGE.studyclub-plusplus.com', '/')).toBe('https://stage.studyclub.life/');
  });
  it('새 도메인·다른 도메인은 넘기지 않는다', () => {
    expect(legacyRedirectUrl('studyclub.life', '/')).toBeNull();
    expect(legacyRedirectUrl('evilstudyclub-plusplus.com', '/')).toBeNull();
    expect(legacyRedirectUrl(null, '/')).toBeNull();
  });
});
