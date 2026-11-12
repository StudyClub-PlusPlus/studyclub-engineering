// 크레딧(/++) 명단 — 숨은 페이지라 API 없이 정적 데이터로 둔다.
// 등재 기준: 3개월 이상 함께했고 결과물(머지 PR·스펙·디자인)이 남은 사람. 운영진이 판정하고 본인 동의를 받는다.
// 숫자는 GitHub 머지 PR·커밋 기준 (2026-11-12 집계). 이메일 등 연락처는 넣지 않는다.

// 작업 한 건의 출처. 지금은 GitHub 머지 PR 과 손으로 적은 것(manual)만 있다.
// zapp 담당 이슈와 디스코드 메시지는 수집 파이프라인(raw)에서 채운다 — 이 파일에서 직접 가져오지 않는다.
export type WorkSource = 'github' | 'zapp' | 'discord' | 'manual';
export type QuestKind = 'SPEC' | 'API' | 'UI' | 'DESIGN';
export type QuestItem = { kind: QuestKind; title: string; date: string; source: WorkSource; no?: number; url?: string };
export type Quest = {
  title: string;
  when: string;
  why: string;
  image?: string;
  items: QuestItem[];
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
          { kind: 'SPEC', source: 'github', no: 23, date: '09.03', title: '회원가입·온보딩 흐름 초안' },
          { kind: 'API', source: 'github', no: 49, date: '09.12', title: '소셜 로그인 식별을 (발급자, sub) 기준으로' },
          { kind: 'API', source: 'github', no: 78, date: '09.16', title: '로그인 주체를 이메일에서 계정 ID 로' },
          { kind: 'SPEC', source: 'github', no: 80, date: '09.16', title: '백오피스 로그인 — 관리자만 통과' },
          {
            kind: 'UI',
            source: 'github',
            no: 86,
            date: '09.19',
            title: '백오피스 허용 목록을 관리자 게이트로 (BE+FE)',
          },
        ],
      },
      {
        title: '마이페이지 프로필',
        when: '10월',
        why: '닉네임·시간대·마케팅 수신 동의를 직접 고치고, 시간대는 화면과 서버가 같은 규칙으로 막는다.',
        items: [
          { kind: 'SPEC', source: 'github', no: 149, date: '10.02', title: '프로필 수정 — 닉네임·시간대' },
          { kind: 'UI', source: 'github', no: 175, date: '10.08', title: '마이페이지 프로필 수정' },
          { kind: 'API', source: 'github', no: 262, date: '10.20', title: '내 정보 조회 GET /api/me' },
          { kind: 'API', source: 'github', no: 263, date: '10.21', title: '서버 시간대 검증' },
        ],
      },
      {
        title: '프로필 사진과 공용 업로드',
        when: '10월',
        why: '사진 하나 올리는 기능을 만들면서 다른 기능도 쓸 수 있는 업로드 API 를 같이 깔았다.',
        items: [
          { kind: 'SPEC', source: 'github', no: 214, date: '10.14', title: '프로필 사진 업로드 스펙' },
          { kind: 'API', source: 'github', no: 261, date: '10.16', title: '공용 이미지 업로드와 정리 배치' },
        ],
      },
      {
        title: '사이트 공지',
        when: '10월 말',
        why: '캡틴이 공지를 쓰고 크루가 읽는다.',
        items: [
          { kind: 'SPEC', source: 'github', no: 344, date: '10.26', title: '사이트 공지 API 스펙' },
          { kind: 'UI', source: 'github', no: 372, date: '10.31', title: '사이트 공지 — 작성과 열람' },
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
        items: [{ kind: 'UI', source: 'github', no: 84, date: '09.19', title: '스터디 카테고리 필터 프로토타입' }],
      },
      {
        title: '백오피스 스터디 관리',
        when: '10월',
        why: '캡틴이 스터디를 목록에서 보고, 직접 만들고 고치고 지울 수 있게.',
        items: [
          { kind: 'UI', source: 'github', no: 204, date: '10.09', title: '백오피스 스터디 목록 화면과 API 연결' },
          { kind: 'UI', source: 'github', no: 286, date: '10.22', title: '백오피스 스터디 등록·수정·삭제' },
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
    loot: ['스터디클럽 로고 디자인', '디자인 시스템 컬러 정의와 적용', '타이포그래피 체계 정리'],
    shipped: ['스터디클럽 로고', '서비스 전체 색', '글자 체계', '버튼'],
    quests: [
      {
        title: '스터디클럽 로고',
        when: '2026',
        why: '사이트·디스코드·앱 어디서나 보이는 스터디클럽의 얼굴을 그렸다.',
        image: '/logo-mark.png',
        items: [{ kind: 'DESIGN', source: 'manual', date: '2026', title: '스터디클럽 로고 디자인' }],
      },
      {
        title: '디자인 시스템',
        when: '10월',
        why: '화면마다 제각각이던 색·글자·버튼을 하나의 체계로 묶었다. 지금 보이는 스터디클럽의 얼굴이다.',
        items: [
          { kind: 'UI', source: 'github', no: 229, date: '10.11', title: '디자인 시스템 — 컬러 적용' },
          { kind: 'UI', source: 'github', no: 291, date: '10.27', title: '디자인 시스템 — 타이포그래피' },
          { kind: 'UI', source: 'github', no: 388, date: '10.31', title: '디자인 시스템 — 버튼 업데이트' },
        ],
      },
    ],
  },
];

// 지금 함께하는 크루 — 머지 PR 수와 최근 PR 3건 (StudyClub-PlusPlus 전체 레포, 2026-11-12 스냅샷).
// PR 이 없는 사람(기획·운영)도 직군으로 싣는다. 연락처는 넣지 않는다.
export type CrewMember = {
  handle: string;
  name: string;
  initial: string;
  cls: Contributor['cls'];
  role: string;
  prs: number;
  recent: { repo: string; no: number; date: string; title: string }[];
};

export const CREW_SNAPSHOT = '2026.11.12';
export const CREW: CrewMember[] = [
  {
    handle: 'titaniper',
    name: '강주영',
    initial: '주',
    cls: 'BARD',
    role: 'PO',
    prs: 104,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 400,
        date: '10.31',
        title: 'feat(core-front): 소개·가이드 페이지 그래픽 개편',
      },
    ],
  },
  {
    handle: 'doxxx93',
    name: '김도율',
    initial: '도',
    cls: 'WARRIOR',
    role: '백엔드',
    prs: 32,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 411,
        date: '11.02',
        title: 'chore(skill): 스킬의 깨진 링크·틀린 명령 정정과 description 사용 시점 추가',
      },
      {
        repo: 'studyclub-engineering',
        no: 393,
        date: '10.31',
        title: 'feat(api): 회원 탈퇴를 운영 알림 채널에 알린다 — 디스코드 role 수동 정리용',
      },
      {
        repo: 'studyclub-engineering',
        no: 390,
        date: '10.31',
        title: 'feat(back-office-front): 신청자 탭에 네비게이터 지정·해제(역할 변경)를 붙인다',
      },
    ],
  },
  {
    handle: 'LeenaKim',
    name: '김리나',
    initial: '리',
    cls: 'ARCHER',
    role: '프론트 · 백엔드',
    prs: 7,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 376,
        date: '10.30',
        title: 'feat(core-front): 온보딩 후 디스코드 연결 선택 · 탈퇴 안내 (DSC-03)',
      },
      {
        repo: 'studyclub-engineering',
        no: 243,
        date: '10.20',
        title: 'feat(api): 운영 대시보드 stats API · 목록 모집 판정 정합',
      },
      {
        repo: 'studyclub-engineering',
        no: 178,
        date: '10.04',
        title: 'feat(auth): 요청 인가 가드(@RequireAdmin·@RequireCaptainOrNavigator) 구현',
      },
    ],
  },
  {
    handle: 'mikim42',
    name: '김민균',
    initial: '민',
    cls: 'BARD',
    role: '운영',
    prs: 0,
    recent: [],
  },
  {
    handle: 'jyami-kim',
    name: '김민정',
    initial: '민',
    cls: 'WARRIOR',
    role: '백엔드 · 프론트',
    prs: 4,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 412,
        date: '11.07',
        title: 'feat(discord): 출석체크 결과를 회차 행 ID 대신 회차 번호(studyMeetingNumber)로 적는다',
      },
      {
        repo: 'studyclub-engineering',
        no: 153,
        date: '10.03',
        title: 'docs(obs): Grafana 알림을 디스코드 봇으로 — 규칙 11종과 추가 절차',
      },
      {
        repo: 'studyclub-engineering',
        no: 144,
        date: '09.29',
        title: 'feat(discord): !출석체크 — 공부방 스냅샷으로 출석을 찍는다',
      },
    ],
  },
  {
    handle: 'boakim-dev',
    name: '김보아',
    initial: '보',
    cls: 'WARRIOR',
    role: '백엔드 · 프론트',
    prs: 12,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 382,
        date: '10.31',
        title: '[DSC-10] 백오피스 스터디 디스코드 연결 상태 및 재연결',
      },
      { repo: 'studyclub-engineering', no: 302, date: '10.23', title: 'feat(back-office): 참여자 반 배정 구현' },
      {
        repo: 'studyclub-engineering',
        no: 313,
        date: '10.23',
        title: '[FE 107] 백오피스 신청 결과 질문별·응답자별 조회 구현',
      },
    ],
  },
  {
    handle: 'CLEO525',
    name: '김지연',
    initial: '지',
    cls: 'ARCHER',
    role: '프론트',
    prs: 23,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 403,
        date: '10.31',
        title: 'test(e2e): 화면 카탈로그 확장 · 스크린샷 다시 찍기 (새 로고)',
      },
      {
        repo: 'studyclub-engineering',
        no: 402,
        date: '10.31',
        title: 'refactor(frontend): 기능별 구조로 재편 · zod/RHF 검증 · 공용 types/utils 분리',
      },
      {
        repo: 'studyclub-engineering',
        no: 399,
        date: '10.31',
        title: 'feat(core-front): Amplitude 빠진 계측 연결 — 화면 조회 · 디스코드 연동 성공/실패 · 스터디룸',
      },
    ],
  },
  {
    handle: 'kimjiy9607',
    name: '김지윤',
    initial: '지',
    cls: 'WARRIOR',
    role: '백엔드 · 인프라',
    prs: 66,
    recent: [
      { repo: 'studyclub-engineering', no: 461, date: '11.12', title: 'feat: 신청자 목록에서 캡틴을 맨 앞에 정렬' },
      {
        repo: 'studyclub-engineering',
        no: 458,
        date: '11.12',
        title: 'fix: 행사 메뉴·화면을 API 연결 전까지 비활성화',
      },
      {
        repo: 'studyclub-engineering',
        no: 459,
        date: '11.12',
        title: 'fix: 모바일 스터디 카드 헤더 배지·카테고리 겹침 수정',
      },
    ],
  },
  {
    handle: 'seeunrosypark',
    name: '박세은',
    initial: '세',
    cls: 'WARRIOR',
    role: '백엔드 · 프론트',
    prs: 58,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 331,
        date: '10.25',
        title: 'fix(attendance): 출석률을 PRD 식으로 — 체크된 회차만 분모, 휴가는 분모에서 뺀다',
      },
      {
        repo: 'studyclub-engineering',
        no: 328,
        date: '10.25',
        title: 'feat(study): 스터디 시간대(KST · PST · BOTH) 저장 — 등록 · 수정 · 상세 (#110)',
      },
      {
        repo: 'studyclub-engineering',
        no: 342,
        date: '10.25',
        title: 'docs(share): 10-24 디스코드 스쿼드 회의 합의 반영',
      },
    ],
  },
  {
    handle: 'j00hyun',
    name: '박주현',
    initial: '주',
    cls: 'WARRIOR',
    role: '백엔드',
    prs: 32,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 448,
        date: '11.11',
        title: 'feat: GA4·Amplitude·Clarity 식별자 보호·수집 중단 및 GA4·Amplitude 삭제',
      },
      {
        repo: 'studyclub-engineering',
        no: 457,
        date: '11.11',
        title: 'fix: 분석 삭제·재로그인·페이지 조회 보완 및 방침 문구 stage 반영',
      },
      {
        repo: 'studyclub-engineering',
        no: 449,
        date: '11.10',
        title: 'feat: Clarity 수집 중단·처리방침 스테이지 반영',
      },
    ],
  },
  {
    handle: 'unknown33572',
    name: '신동일',
    initial: '동',
    cls: 'WARRIOR',
    role: '백엔드 · 프론트',
    prs: 2,
    recent: [
      { repo: 'studyclub-engineering', no: 373, date: '10.31', title: 'feat: 문의·오류 신고 구현' },
      { repo: 'studyclub-engineering', no: 341, date: '10.27', title: 'docs: 문의·오류 신고 API 스펙 초안' },
    ],
  },
  {
    handle: 'rowing0328',
    name: '신효승',
    initial: '효',
    cls: 'WARRIOR',
    role: '백엔드 · 프론트',
    prs: 6,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 387,
        date: '10.31',
        title: '커뮤니티 스쿼드 기능의 컨벤션 위반 수정과 가이드 문서 정리',
      },
      {
        repo: 'studyclub-engineering',
        no: 271,
        date: '10.25',
        title: 'feat(dashboard): 백오피스 대시보드를 stats API 로 — KPI · 현황 보드 · 지역 분포 · 출석 추세 · 카테고리',
      },
      {
        repo: 'studyclub-engineering',
        no: 219,
        date: '10.10',
        title: 'feat(admin-users): 백오피스 회원 API — 목록 · 이메일 보기 · 권한 변경 · 권한표',
      },
    ],
  },
  {
    handle: 'joonscode',
    name: '윤준수',
    initial: '준',
    cls: 'ENGINEER',
    role: '디바이스 · 운영',
    prs: 25,
    recent: [
      { repo: 'studyclub-mobile', no: 16, date: '10.30', title: '[sc-69] chore: 내 스터디 피처 플래그 Ready 전환' },
      { repo: 'studyclub-mobile', no: 29, date: '10.30', title: '[sc-79] chore: MyPage 피처 플래그 Ready 전환' },
      { repo: 'studyclub-mobile', no: 27, date: '10.30', title: '[sc-53] chore: 로그인 피처 플래그 Ready 전환' },
    ],
  },
  {
    handle: 'onzomonzo',
    name: '이가온',
    initial: '가',
    cls: 'BARD',
    role: '기획 · 운영',
    prs: 48,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 361,
        date: '10.26',
        title: 'design: 화면에서는 「운영진」이 아니라 「캡틴」',
      },
      {
        repo: 'studyclub-engineering',
        no: 360,
        date: '10.26',
        title: 'design: 참여 중에는 디스코드 연결을 바꿀 수 없다 — 해제도 교체도',
      },
      {
        repo: 'studyclub-engineering',
        no: 358,
        date: '10.26',
        title: 'design: 제목 한도는 폭 40 — 한글 20자 · 영문 40자',
      },
    ],
  },
  {
    handle: 'Jeongyounghyeon',
    name: '정영현',
    initial: '영',
    cls: 'WARRIOR',
    role: '백엔드',
    prs: 13,
    recent: [
      {
        repo: 'studyclub-engineering',
        no: 419,
        date: '11.10',
        title:
          'refactor(notification): 같은 조건 템플릿 여럿 후속 — 공지 메일 건수를 DB 에서 집계, 롤아웃 문서 보강 (ST-030)',
      },
      {
        repo: 'studyclub-engineering',
        no: 384,
        date: '10.31',
        title: 'docs(notification): 같은 조건에 템플릿 여럿 — 스펙 (ST-030)',
      },
      {
        repo: 'studyclub-engineering',
        no: 374,
        date: '10.29',
        title: 'feat(notification): 알림 템플릿 추가 · 수정 · 삭제 API (ST-030)',
      },
    ],
  },
  {
    handle: 'j7hwang',
    name: '황준희',
    initial: '준',
    cls: 'BARD',
    role: '운영',
    prs: 0,
    recent: [],
  },
];

export const repoPrUrl = (repo: string, no: number) => `https://github.com/StudyClub-PlusPlus/${repo}/pull/${no}`;
export const findCrew = (handle: string) => CREW.find((c) => c.handle.toLowerCase() === handle.toLowerCase());

export const findLegend = (handle: string) => LEGENDS.find((c) => c.handle.toLowerCase() === handle.toLowerCase());
