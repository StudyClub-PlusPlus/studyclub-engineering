// 스터디/행사 썸네일 — 이미지가 있으면 그대로, 없으면 "디자인된" fallback:
// 큐레이션된 절제 팔레트 + lucide 라인 아이콘 + 카테고리 라벨. (이모지·랜덤 무지개 그라디언트 X)
// 외부 의존/네트워크 없음. seed 해시로 팔레트를 뽑아 SSR/CSR 이 항상 동일. (server component)
import {
  Brain,
  Puzzle,
  MessagesSquare,
  BookOpen,
  Database,
  Code2,
  Languages,
  Sunrise,
  Package,
  Briefcase,
  Hash,
  type LucideIcon,
} from 'lucide-react';

// 큐레이션된 팔레트(무지개 랜덤 대신 톤 정돈). [진한, 옅은] 2톤 대각 그라디언트.
type Duo = [string, string];
const C = {
  indigo: ['#3730a3', '#4f46e5'] as Duo,
  violet: ['#5b21b6', '#7c3aed'] as Duo,
  blue: ['#1e40af', '#3b82f6'] as Duo,
  teal: ['#115e59', '#0d9488'] as Duo,
  emerald: ['#065f46', '#059669'] as Duo,
  amber: ['#92400e', '#d97706'] as Duo,
  rose: ['#9f1239', '#e11d48'] as Duo,
  slate: ['#334155', '#64748b'] as Duo,
};

/**
 * 카테고리 → 아이콘 + 라벨 + 색. **색은 카테고리를 따라간다** (같은 분야 = 같은 색).
 *
 * ⚠️ 배열 순서 = 우선순위. 위에서부터 첫 일치를 쓰므로 **구체적인 것이 위**, 포괄적인 것이 아래다.
 * (DB 강의 → 데이터, 리트코드 → 알고리즘, 나머지 코딩 → 소프트웨어 개발)
 * canonical 목록은 `@studyclub/mock` 의 `STUDY_CATEGORIES`. 여기 match 배열은 그 라벨 +
 * 기존 자유입력 데이터(레거시 표기)를 함께 흡수한다.
 */
const RULES: { match: string[]; icon: LucideIcon; label: string; color: Duo }[] = [
  {
    match: ['ai · ml', 'ai/ml', 'ai', 'ml', '머신러닝', '딥러닝', 'llm', '논문', 'kaggle', '캐글', 'causal', '인과'],
    icon: Brain,
    label: 'AI · ML',
    color: C.violet,
  },
  {
    match: ['알고리즘', 'algorithm', 'leetcode', '리트코드', 'neetcode', '코테'],
    icon: Puzzle,
    label: 'ALGORITHM',
    color: C.blue,
  },
  { match: ['데이터', 'data', 'sql', 'db', '디비'], icon: Database, label: 'DATA', color: C.teal },
  {
    match: ['기획', 'pm', '프로덕트', 'product', '그로스', 'growth'],
    icon: Package,
    label: '기획 · PM',
    color: C.violet,
  },
  {
    match: ['커리어', 'career', '이력서', 'resume', '인터뷰', 'interview', '면접'],
    icon: MessagesSquare,
    label: 'CAREER',
    color: C.amber,
  },
  {
    match: ['비즈니스', 'business', '아티클', 'article', '시장', '산업'],
    icon: Briefcase,
    label: 'BUSINESS',
    color: C.slate,
  },
  { match: ['북클럽', 'book', '독서', '리딩'], icon: BookOpen, label: 'BOOK CLUB', color: C.amber },
  {
    match: ['어학', '언어', 'language', '영어', '중국어', '독일어', 'german', 'english', 'chinese'],
    icon: Languages,
    label: 'LANGUAGE',
    color: C.emerald,
  },
  {
    match: [
      '라이프스타일',
      'lifestyle',
      '습관',
      'habit',
      '회고',
      'retro',
      '네트워킹',
      'network',
      '커피챗',
      '밋업',
      'meetup',
    ],
    icon: Sunrise,
    label: 'LIFESTYLE',
    color: C.rose,
  },
  // 아래 두 개는 포괄 항목 — 위에서 안 걸린 것만 받는다
  {
    match: [
      '소프트웨어 개발',
      '코딩',
      'coding',
      '개발',
      'dev',
      '프론트',
      'frontend',
      '백엔드',
      'backend',
      '클라우드',
      'cloud',
      '보안',
      'security',
      'react',
      'golang',
      'redis',
    ],
    icon: Code2,
    label: 'DEV',
    color: C.indigo,
  },
  { match: ['기타', 'etc', 'other'], icon: Hash, label: 'ETC', color: C.slate },
];

// 규칙에 안 걸리는 값(레거시 자유입력)은 팔레트에서 순환 배정 — 같은 값이면 항상 같은 색.
const FALLBACK: Duo[] = [C.indigo, C.teal, C.amber, C.rose, C.violet, C.blue, C.emerald, C.slate];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function pick(category?: string): { icon: LucideIcon; label: string; color: Duo } {
  const key = (category ?? '').toLowerCase();
  for (const r of RULES) if (r.match.some((m) => key.includes(m))) return r;
  const label = (category ?? 'STUDY').toUpperCase().slice(0, 10);
  return { icon: Hash, label, color: FALLBACK[hash(label) % FALLBACK.length] };
}

/** 카테고리 → 아이콘·라벨·색. 카드 헤더에서 재사용. */
export function categoryMeta(category?: string): { icon: LucideIcon; label: string; color: Duo } {
  return pick(category);
}

/** 카테고리 색 그라디언트 CSS 값. */
export function categoryGradient(category?: string): string {
  const [from, to] = pick(category).color;
  return `linear-gradient(120deg, ${from}, ${to})`;
}

export function StudyThumb({
  image,
  category,
  className = '',
}: {
  image?: string;
  seed?: string;
  category?: string;
  emoji?: string;
  className?: string;
}) {
  const base = 'relative w-full aspect-[16/6] overflow-hidden';

  if (image && image.trim() !== '') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt='' className={`${base} object-cover ${className}`} />
    );
  }

  const { icon: Icon, label, color } = pick(category);
  const [from, to] = color;

  return (
    <div
      className={`${base} flex items-center gap-3 px-5 ${className}`}
      style={{ background: `linear-gradient(120deg, ${from}, ${to})` }}
      aria-hidden='true'
    >
      {/* 큰 라인 아이콘 워터마크(우측, 은은) */}
      <Icon className='pointer-events-none absolute -right-3 -bottom-4 text-white/15' size={104} strokeWidth={1.25} />
      <Icon className='relative shrink-0 text-white' size={22} strokeWidth={1.75} />
      <span className='relative text-[13px] font-bold uppercase tracking-[0.14em] text-white/90'>{label}</span>
    </div>
  );
}
