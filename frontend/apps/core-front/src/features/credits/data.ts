// 크레딧(/++) 명단 — 숨은 페이지라 API 없이 정적 데이터로 둔다.
// 등재 기준: 3개월 이상 함께했고 결과물(머지 PR·스펙·디자인)이 남은 사람. 운영진이 판정하고 본인 동의를 받는다.
// 숫자는 GitHub 머지 PR·커밋 기준 (2026-11-12 집계). 이메일 등 연락처는 넣지 않는다.

export type QuestKind = 'SPEC' | 'API' | 'UI';
export type Quest = {
  title: string;
  when: string;
  why: string;
  items: { kind: QuestKind; no: number; date: string; title: string }[];
};
export type Contributor = {
  handle: string;
  name: string;
  initial: string;
  cls: 'WARRIOR' | 'ARCHER' | 'MAGE' | 'BARD' | 'ENGINEER';
  role: string;
  period: string;
  cleared: string;
  stats: { prs: number; specs: number; commits: number };
  loot: string[];
  shipped: string[];
  quests: Quest[];
};

export const PR_URL = 'https://github.com/StudyClub-PlusPlus/studyclub-engineering/pull/';

export const LEGENDS: Contributor[] = [
  {
    handle: 'hereokay',
    name: '이진중',
    initial: '진',
    cls: 'WARRIOR',
    role: '백엔드 · 프론트',
    period: '2026.08 — 2026.11',
    cleared: '2026.11.12',
    stats: { prs: 13, specs: 5, commits: 67 },
    loot: [
      '소셜 로그인을 (발급자, sub) 기준으로 바꿔 계정이 겹치지 않게',
      '백오피스는 관리자만 들어오게 — 권한 게이트',
      '프로필 사진 업로드와 공용 이미지 업로드 API',
    ],
    shipped: ['구글 로그인', '백오피스 관리자 로그인', '마이페이지 프로필 수정', '프로필 사진', '사이트 공지'],
    quests: [
      {
        title: '로그인과 계정',
        when: '9월',
        why: '구글로 가입한 사람이 이메일을 바꿔도 같은 계정으로 들어오게, 백오피스는 관리자만 들어오게.',
        items: [
          { kind: 'SPEC', no: 23, date: '09.03', title: '회원가입·온보딩 흐름 초안' },
          { kind: 'API', no: 49, date: '09.12', title: '소셜 로그인 식별을 (발급자, sub) 기준으로' },
          { kind: 'API', no: 78, date: '09.16', title: '로그인 주체를 이메일에서 계정 ID 로' },
          { kind: 'SPEC', no: 80, date: '09.16', title: '백오피스 로그인 — 관리자만 통과' },
          { kind: 'UI', no: 86, date: '09.19', title: '백오피스 허용 목록을 관리자 게이트로 (BE+FE)' },
        ],
      },
      {
        title: '마이페이지 프로필',
        when: '10월',
        why: '닉네임·시간대·마케팅 수신 동의를 직접 고치고, 시간대는 화면과 서버가 같은 규칙으로 막는다.',
        items: [
          { kind: 'SPEC', no: 149, date: '10.02', title: '프로필 수정 — 닉네임·시간대' },
          { kind: 'UI', no: 175, date: '10.08', title: '마이페이지 프로필 수정' },
          { kind: 'API', no: 262, date: '10.20', title: '내 정보 조회 GET /api/me' },
          { kind: 'API', no: 263, date: '10.21', title: '서버 시간대 검증' },
        ],
      },
      {
        title: '프로필 사진과 공용 업로드',
        when: '10월',
        why: '사진 하나 올리는 기능을 만들면서 다른 기능도 쓸 수 있는 업로드 API 를 같이 깔았다.',
        items: [
          { kind: 'SPEC', no: 214, date: '10.14', title: '프로필 사진 업로드 스펙' },
          { kind: 'API', no: 261, date: '10.16', title: '공용 이미지 업로드와 정리 배치' },
        ],
      },
      {
        title: '사이트 공지',
        when: '10월 말',
        why: '캡틴이 공지를 쓰고 크루가 읽는다.',
        items: [
          { kind: 'SPEC', no: 344, date: '10.26', title: '사이트 공지 API 스펙' },
          { kind: 'UI', no: 372, date: '10.31', title: '사이트 공지 — 작성과 열람' },
        ],
      },
    ],
  },
  {
    handle: '1ZnCl2',
    name: '조아연',
    initial: '아',
    cls: 'ARCHER',
    role: '프론트 · 기획',
    period: '2026.08 — 2026.11',
    cleared: '2026.11.12',
    stats: { prs: 3, specs: 0, commits: 43 },
    loot: ['백오피스 스터디 목록 화면과 API 연결', '백오피스 스터디 등록·수정·삭제', '스터디 카테고리 필터 프로토타입'],
    shipped: ['백오피스 스터디 목록', '백오피스 스터디 등록·수정·삭제'],
    quests: [
      {
        title: '스터디 찾기 프로토타입',
        when: '9월',
        why: '카테고리로 스터디를 거르는 흐름을 화면으로 먼저 세워 봤다.',
        items: [{ kind: 'UI', no: 84, date: '09.19', title: '스터디 카테고리 필터 프로토타입' }],
      },
      {
        title: '백오피스 스터디 관리',
        when: '10월',
        why: '캡틴이 스터디를 목록에서 보고, 직접 만들고 고치고 지울 수 있게.',
        items: [
          { kind: 'UI', no: 204, date: '10.09', title: '백오피스 스터디 목록 화면과 API 연결' },
          { kind: 'UI', no: 286, date: '10.22', title: '백오피스 스터디 등록·수정·삭제' },
        ],
      },
    ],
  },
  {
    handle: 'yeonji-design',
    name: '김연지',
    initial: '연',
    cls: 'MAGE',
    role: '디자인 리드 · 기획',
    period: '2026.08 — 2026.11',
    cleared: '2026.11.12',
    stats: { prs: 3, specs: 0, commits: 3 },
    loot: ['디자인 시스템 컬러 정의와 적용', '타이포그래피 체계 정리', '버튼 컴포넌트 디자인 갱신'],
    shipped: ['서비스 전체 색', '글자 체계', '버튼'],
    quests: [
      {
        title: '디자인 시스템',
        when: '10월',
        why: '화면마다 제각각이던 색·글자·버튼을 하나의 체계로 묶었다. 지금 보이는 스터디클럽의 얼굴이다.',
        items: [
          { kind: 'UI', no: 229, date: '10.11', title: '디자인 시스템 — 컬러 적용' },
          { kind: 'UI', no: 291, date: '10.27', title: '디자인 시스템 — 타이포그래피' },
          { kind: 'UI', no: 388, date: '10.31', title: '디자인 시스템 — 버튼 업데이트' },
        ],
      },
    ],
  },
];

export const findLegend = (handle: string) => LEGENDS.find((c) => c.handle.toLowerCase() === handle.toLowerCase());
