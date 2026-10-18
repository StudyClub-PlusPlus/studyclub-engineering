/**
 * 문의·오류 신고 (프로토 mock) — 사용자 사이트가 보내고 운영 콘솔이 받는다.
 *
 * **로그인한 사람만 보낸다** — 제출자는 늘 있다. 캡틴이 회신하면 제출자가 「내 문의」에서 본다.
 * 화면 경로는 모으지 않는다 — 내 문의 목록을 거쳐 쓰므로 경로가 문제의 화면을 가리키지 않는다.
 *
 * 두 앱이 같은 브라우저(playground)에 떠 있으므로, 사이트에서 보낸 것과 콘솔에서 바꾼 상태·메모·회신을
 * localStorage 에 남겨 서로 보이게 한다. 시드(더미)는 그 위에 깔린다.
 *
 * TODO(api): POST /api/feedbacks(인증 필수) · GET /api/my/feedbacks(/{id}) · GET·PATCH /api/admin/feedbacks(/{id})
 */

export type FeedbackType = 'bug' | 'idea' | 'question';
export type FeedbackStatus = 'new' | 'seen' | 'done';

/** 고르는 순서 — 문의 · 개선 의견 · 오류 신고 */
export const FEEDBACK_TYPES: { value: FeedbackType; label: string }[] = [
  { value: 'question', label: '문의' },
  { value: 'idea', label: '개선 의견' },
  { value: 'bug', label: '오류 신고' },
];
export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = { bug: '오류 신고', idea: '개선 의견', question: '문의' };

export const FEEDBACK_STATUSES: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: '미확인' },
  { value: 'seen', label: '확인' },
  { value: 'done', label: '완료' },
];
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = { new: '미확인', seen: '확인', done: '완료' };

export const TITLE_MIN = 2;
export const TITLE_MAX = 100;
export const BODY_MIN = 10;
export const BODY_MAX = 2000;

/** 이미지 첨부 — 장수 · 장당 원본 크기 · 받는 형식 */
export const IMAGE_MAX_COUNT = 3;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export type Feedback = {
  id: string;
  type: FeedbackType;
  title: string;
  /** 평문. HTML 로 해석하지 않는다 */
  body: string;
  /** 첨부 이미지. 프로토는 줄인 data URL — 실제로는 업로드 fileId (STORAGE_OBJECT) */
  images?: string[];
  /** 제출자 닉네임 — 로그인해야 보낼 수 있어 늘 있다 */
  author: string;
  /** 제출자가 탈퇴함 → 「탈퇴한 사용자」 */
  authorLeft?: boolean;
  /** 자동 수집 — 사용자가 입력하지 않는다. 브라우저·OS 와 화면 크기만 */
  userAgent: string;
  viewport: string;
  createdAt: string; // ISO
  status: FeedbackStatus;
  /** 「완료」로 바꾼 캡틴 — 회신으로든 상태 변경으로든. 완료가 아니면 없거나 빈 문자열 */
  doneBy?: string;
  /** 캡틴 회신 — 제출자가 내 문의에서 본다. 수정해도 시각은 처음 보낸 때 */
  reply?: { body: string; at: string };
  /** 캡틴 전용 메모 — 내부용, 사용자에게 보이지 않는다 */
  memo: string;
};

const SENT_KEY = 'sc_feedback_sent';
const PATCH_KEY = 'sc_feedback_patch';

type Patch = Partial<Pick<Feedback, 'status' | 'memo' | 'reply' | 'doneBy'>>;

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간이 막혀도 프로토는 계속 돈다 */
  }
}

const UA_MAC = 'Chrome 141 · macOS';
const UA_WIN = 'Edge 140 · Windows';
const UA_IOS = 'Safari 26 · iOS';
const UA_AND = 'Chrome 141 · Android';

/** 더미 스크린샷 — 실제 이미지 대신 회색 화면에 한 줄 설명을 그린 SVG */
function shot(label: string, w = 1280, h = 800): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><rect width='100%' height='100%' fill='#eef0f5'/><rect x='0' y='0' width='100%' height='64' fill='#2b2d42'/><rect x='48' y='120' width='${w - 96}' height='${h - 200}' rx='16' fill='#ffffff' stroke='#d6d9e2'/><text x='50%' y='52%' text-anchor='middle' font-family='sans-serif' font-size='${Math.round(w / 32)}' fill='#6b7080'>${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 더미 — 최근 3주치. 미확인이 위에 섞이게 */
const SEED: Omit<Feedback, 'status' | 'memo'>[] = [
  { id: 'fb-24', type: 'bug', title: '신청하기 눌렀는데 디스코드 연동 창이 계속 다시 떠요', body: '디스코드 연결을 끝냈는데 신청하기를 누르면 연결 창이 또 뜹니다.\n새로고침해도 똑같아요.', author: '하늘', userAgent: UA_MAC, viewport: '1440 × 900', createdAt: '2026-10-18T13:12:00Z' , images: [shot('디스코드 연결 창이 다시 뜬 화면'), shot('신청하기 버튼 상태')] },
  { id: 'fb-23', type: 'question', title: '북미에 사는데 한국 시간 스터디 참여해도 되나요?', body: 'LA 에 살고 있습니다. 화요일 저녁 8시(KST) 스터디가 있던데 여기서는 새벽 4시라서요. 녹화로 참여해도 되는지 궁금합니다.', author: 'jay_la', userAgent: UA_IOS, viewport: '390 × 844', createdAt: '2026-10-18T05:40:00Z' },
  { id: 'fb-22', type: 'idea', title: '스터디 목록에서 시간대로 거를 수 있으면 좋겠어요', body: '북미 사람이라 PST 로 진행하는 스터디만 보고 싶은데 필터가 없어서 하나씩 열어 봐야 해요.', author: 'minji', userAgent: UA_MAC, viewport: '1280 × 800', createdAt: '2026-10-17T22:03:00Z' },
  { id: 'fb-21', type: 'bug', title: '모바일에서 출석 체크 버튼이 안 눌려요', body: '아이폰 사파리에서 오늘 출석 버튼을 눌러도 반응이 없습니다. 데스크톱에서는 됩니다.', author: '도윤', userAgent: UA_IOS, viewport: '375 × 812', createdAt: '2026-10-17T11:30:00Z' , images: [shot('출석 버튼 — iPhone Safari', 390, 844)] },
  { id: 'fb-20', type: 'idea', title: '공지에 이미지도 넣을 수 있으면', author: '홍길동', body: '행사 공지에 장소 지도를 같이 올리면 좋겠어요.', userAgent: UA_WIN, viewport: '1920 × 1080', createdAt: '2026-10-16T09:15:00Z' },
  { id: 'fb-19', type: 'question', title: '스터디 중간에 그만두면 다음 기수 신청에 불이익이 있나요', body: '개인 사정으로 이번 기수를 중간에 그만둬야 할 것 같은데, 다음 기수 신청할 때 영향이 있는지 궁금합니다.', author: '서연', userAgent: UA_MAC, viewport: '1512 × 982', createdAt: '2026-10-15T14:48:00Z' },
  { id: 'fb-18', type: 'bug', title: '<b>마감</b> 이라고 글자가 그대로 보여요', author: '라온', body: '스터디 카드에 <b>마감</b> 처럼 태그가 그대로 나옵니다.', userAgent: UA_AND, viewport: '412 × 915', createdAt: '2026-10-15T02:10:00Z' },
  { id: 'fb-17', type: 'idea', title: '내 스터디룸에서 다음 회차까지 남은 시간 표시', body: '다음 모임이 몇 시간 남았는지 바로 보이면 좋겠습니다.', author: 'eunbi', userAgent: UA_MAC, viewport: '1440 × 900', createdAt: '2026-10-14T19:22:00Z' },
  { id: 'fb-16', type: 'bug', title: '닉네임 바꿨는데 출석부에는 예전 이름이 나와요', body: '마이페이지에서 닉네임을 바꿨는데 출석부에 예전 닉네임이 남아 있습니다.', author: '준호', userAgent: UA_WIN, viewport: '1366 × 768', createdAt: '2026-10-13T08:05:00Z' },
  { id: 'fb-15', type: 'question', title: '클럽이랑 스터디는 뭐가 다른가요', author: '홍길동', body: '모집 중인 목록에 클럽과 스터디가 섞여 있는데 차이를 모르겠습니다.', userAgent: UA_IOS, viewport: '390 × 844', createdAt: '2026-10-12T16:40:00Z' },
  { id: 'fb-14', type: 'idea', title: '다크 모드 지원해 주세요', body: '밤에 출석 체크할 때 화면이 너무 밝아요.', author: 'night_owl', userAgent: UA_AND, viewport: '412 × 915', createdAt: '2026-10-11T23:58:00Z' },
  { id: 'fb-13', type: 'bug', title: '영어로 바꾸면 신청 폼 일부가 한국어로 남아요', body: 'EN 으로 바꾸고 신청하기를 누르면 질문 몇 개가 한국어로 나옵니다.', author: 'alex_nyc', userAgent: UA_MAC, viewport: '1440 × 900', createdAt: '2026-10-10T12:00:00Z' },
  { id: 'fb-12', type: 'idea', title: '찜한 스터디 모집 시작하면 알려 주세요', body: '찜해 둔 스터디가 다음 기수 모집을 시작하면 메일로 알려 주면 좋겠어요.', author: '하늘', userAgent: UA_MAC, viewport: '1440 × 900', createdAt: '2026-10-09T10:20:00Z' },
  { id: 'fb-11', type: 'question', title: '발표자 신청은 어디서 하나요', body: '스터디 일정에서 발표자 신청을 하라고 들었는데 버튼을 못 찾겠습니다.', author: '수아', userAgent: UA_WIN, viewport: '1536 × 864', createdAt: '2026-10-08T07:45:00Z' },
  { id: 'fb-10', type: 'bug', title: '시간대를 북미 서부로 바꿨는데 일정이 한국 시간으로 보여요', body: '마이페이지에서 시간대를 바꿨는데 스터디 일정은 여전히 KST 로 표시됩니다.', author: 'jay_la', userAgent: UA_IOS, viewport: '390 × 844', createdAt: '2026-10-07T03:30:00Z' },
  { id: 'fb-09', type: 'idea', title: '스터디 후기를 볼 수 있으면', author: '홍길동', body: '신청하기 전에 지난 기수 사람들 후기를 볼 수 있으면 고르기 쉬울 것 같아요.', userAgent: UA_AND, viewport: '360 × 800', createdAt: '2026-10-06T13:13:00Z' },
  { id: 'fb-08', type: 'bug', title: '로그인 후 원래 보던 페이지로 안 돌아가요', body: '스터디 상세에서 로그인하면 홈으로 가 버립니다.', author: 'minji', userAgent: UA_MAC, viewport: '1280 × 800', createdAt: '2026-10-05T09:00:00Z' },
  { id: 'fb-07', type: 'question', title: '운영진(캡틴)은 어떻게 지원하나요', body: '캡틴으로 스터디를 열어 보고 싶은데 절차가 궁금합니다.', author: 'eunbi', userAgent: UA_MAC, viewport: '1440 × 900', createdAt: '2026-10-04T15:35:00Z' },
  { id: 'fb-06', type: 'idea', title: '공지 목록에 새 글 표시', author: '태오', body: '마지막으로 본 뒤에 올라온 공지가 무엇인지 알 수 있으면 좋겠어요.', userAgent: UA_WIN, viewport: '1920 × 1080', createdAt: '2026-10-03T11:11:00Z' },
  { id: 'fb-05', type: 'bug', title: '탈퇴 버튼을 눌러도 아무 일이 없어요', body: '회원 탈퇴 화면에서 탈퇴하기를 눌렀는데 그대로입니다.', author: '지후', authorLeft: true, userAgent: UA_AND, viewport: '412 × 915', createdAt: '2026-10-02T20:50:00Z' },
  { id: 'fb-04', type: 'idea', title: '행사 캘린더 내보내기', body: '행사 일정을 구글 캘린더에 바로 넣을 수 있게 해 주세요.', author: '도윤', userAgent: UA_MAC, viewport: '1440 × 900', createdAt: '2026-10-01T06:25:00Z' },
  { id: 'fb-03', type: 'question', title: '스터디 비용이 있나요', author: '나래', body: '모든 스터디가 무료인지 궁금합니다.', userAgent: UA_IOS, viewport: '390 × 844', createdAt: '2026-09-30T17:00:00Z' },
  { id: 'fb-02', type: 'bug', title: '스터디 카드 썸네일이 깨져 보여요', body: '목록에서 일부 카드 이미지가 회색 상자로 나옵니다.', author: '서연', userAgent: UA_WIN, viewport: '1366 × 768', createdAt: '2026-09-29T12:40:00Z' , images: [shot('스터디 목록 — 회색 썸네일')] },
];

/** 오래된 것일수록 처리가 끝나 있게 — 프로토 첫 화면이 현실적으로 보이도록 */
function seedStatus(i: number): FeedbackStatus {
  if (i < 5) return 'new';
  if (i < 11) return i % 2 ? 'seen' : 'new';
  return i % 3 === 0 ? 'seen' : 'done';
}

/** 회신이 달린 더미 — 회신하면 「완료」가 된다 */
const SEED_REPLY: Record<string, { body: string; at: string }> = {
  'fb-15': {
    body: '스터디는 기수마다 정해진 기간에 함께 진도를 나가는 모임이고, 클럽은 기간 없이 매달 이어지는 모임이에요.\n클럽은 매달 추가 모집을 해서 아무 때나 합류할 수 있어요.',
    at: '2026-10-13T02:30:00Z',
  },
  'fb-23': {
    body: '녹화 참여는 스터디마다 캡틴이 정해요. 신청하시고 디스코드 스터디 채널에서 캡틴에게 물어봐 주세요.\n북미 시간대 스터디도 곧 열 예정이에요.',
    at: '2026-10-18T09:10:00Z',
  },
  'fb-07': {
    body: '디스코드 #캡틴-지원 채널에 하고 싶은 스터디 주제와 진행 방식을 남겨 주세요. 운영진이 연락드릴게요.',
    at: '2026-10-05T01:00:00Z',
  },
};

const SEEDED: Feedback[] = SEED.map((f, i) => ({
  ...f,
  status: SEED_REPLY[f.id] ? 'done' : seedStatus(i),
  // 완료 더미는 캡틴 둘이 나눠 처리한 것으로
  doneBy: SEED_REPLY[f.id] || seedStatus(i) === 'done' ? (i % 2 ? '세린' : 'Alex') : undefined,
  reply: SEED_REPLY[f.id],
  memo: i === 6 ? '스터디 카드 제목 렌더링 확인 필요 — 이스케이프 누락 의심' : '',
}));

/** 시드 + 이 브라우저에서 보낸 것, 처리 상태·메모 반영. 접수 시각 내림차순 */
export function listFeedbacks(): Feedback[] {
  const sent = read<Feedback[]>(SENT_KEY, []);
  const patch = read<Record<string, Patch>>(PATCH_KEY, {});
  return [...sent, ...SEEDED]
    .map((f) => ({ ...f, ...patch[f.id] }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getFeedback(id: string): Feedback | undefined {
  return listFeedbacks().find((f) => f.id === id);
}

export function addFeedback(f: Omit<Feedback, 'id' | 'status' | 'memo' | 'createdAt' | 'reply'>): Feedback {
  const item: Feedback = { ...f, id: `fb-${Date.now()}`, createdAt: new Date().toISOString(), status: 'new', memo: '' };
  write(SENT_KEY, [item, ...read<Feedback[]>(SENT_KEY, [])]);
  return item;
}

export function patchFeedback(id: string, next: Patch) {
  const all = read<Record<string, Patch>>(PATCH_KEY, {});
  write(PATCH_KEY, { ...all, [id]: { ...all[id], ...next } });
}

/** 브라우저·OS 를 사람이 읽는 짧은 문구로 — 「Chrome 131 · macOS」. 실제로는 서버가 파싱해 저장한다 */
export function describeAgent(ua: string): string {
  if (!/Mozilla/.test(ua)) return ua; // 이미 파싱된 값(더미)
  const pick = (re: RegExp) => ua.match(re)?.[1];
  const [name, ver] = pick(/Edg\/(\d+)/)
    ? ['Edge', pick(/Edg\/(\d+)/)]
    : pick(/Firefox\/(\d+)/)
      ? ['Firefox', pick(/Firefox\/(\d+)/)]
      : pick(/Chrome\/(\d+)/)
        ? ['Chrome', pick(/Chrome\/(\d+)/)]
        : pick(/Version\/(\d+).*Safari/)
          ? ['Safari', pick(/Version\/(\d+)/)]
          : ['브라우저', undefined];
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : 'OS';
  return `${name}${ver ? ` ${ver}` : ''} · ${os}`;
}

/** 제출자 표기 — 비로그인 「비회원」, 탈퇴 「탈퇴한 사용자」 */
export function submitterLabel(f: Pick<Feedback, 'author' | 'authorLeft'>): string {
  return f.authorLeft ? '탈퇴한 사용자' : f.author;
}

/** 제출자에게 보이는 상태는 둘 — 미확인·확인은 「접수」, 완료는 「답변 완료」 */
export function userStatusLabel(status: FeedbackStatus): string {
  return status === 'done' ? '답변 완료' : '접수';
}

/** 내 문의 — 이 닉네임이 보낸 것만. 실제로는 서버가 토큰으로 본인 것만 돌려준다 */
export function listMyFeedbacks(nickname: string): Feedback[] {
  return listFeedbacks().filter((f) => f.author === nickname && !f.authorLeft);
}
