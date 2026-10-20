import {
  BookOpen,
  Brain,
  Briefcase,
  Code2,
  Database,
  Hash,
  Languages,
  MessagesSquare,
  Monitor,
  Package,
  Palette,
  Puzzle,
  Server,
  Smartphone,
  Sunrise,
  type LucideIcon,
} from 'lucide-react';

type Duo = [string, string];

// 큐레이션된 팔레트. [진한, 옅은] 2톤 대각 그라디언트 — design-system.md §2-6 차트 토큰 기준.
const C = {
  indigo: ['color-mix(in oklab, var(--color-chart-1) 60%, black)', 'var(--color-chart-1)'] as Duo,
  violet: ['color-mix(in oklab, var(--color-chart-4) 60%, black)', 'var(--color-chart-4)'] as Duo,
  blue: ['color-mix(in oklab, var(--color-chart-1) 70%, black)', 'var(--color-chart-1)'] as Duo,
  teal: ['color-mix(in oklab, var(--color-chart-3) 60%, black)', 'var(--color-chart-3)'] as Duo,
  emerald: ['color-mix(in oklab, var(--color-chart-5) 60%, black)', 'var(--color-chart-5)'] as Duo,
  amber: ['color-mix(in oklab, var(--color-chart-2) 60%, black)', 'var(--color-chart-2)'] as Duo,
  rose: ['color-mix(in oklab, var(--color-chart-6) 60%, black)', 'var(--color-chart-6)'] as Duo,
  slate: ['var(--color-neutral-800)', 'var(--color-neutral-600)'] as Duo,
};

// art = 카테고리 스팟 이미지 slug — 앱 public 의 /study-art/study-<art>.webp (zapp-design:icon 으로 생성, 원본은 내부 design/assets/icons).
type Meta = { icon: LucideIcon; label: string; color: Duo; art?: string };

const AI_ML: Meta = { icon: Brain, label: 'AI · ML', color: C.violet, art: 'ai_ml' };
const ALGORITHM: Meta = { icon: Puzzle, label: '알고리즘', color: C.blue, art: 'algorithm' };
const DATA: Meta = { icon: Database, label: '데이터', color: C.teal, art: 'data' };
const SOFTWARE: Meta = { icon: Code2, label: '소프트웨어 개발', color: C.indigo, art: 'software' };
const CAREER: Meta = { icon: MessagesSquare, label: '커리어', color: C.amber, art: 'career' };
const BOOK_CLUB: Meta = { icon: BookOpen, label: '북클럽', color: C.amber, art: 'book_club' };
const LANGUAGE: Meta = { icon: Languages, label: '어학', color: C.emerald, art: 'language' };
const LIFESTYLE: Meta = { icon: Sunrise, label: '라이프스타일', color: C.rose, art: 'lifestyle' };
const PRODUCT: Meta = { icon: Package, label: '기획 · PM', color: C.violet, art: 'product' };
const BUSINESS: Meta = { icon: Briefcase, label: '비즈니스', color: C.slate, art: 'business' };
const OTHER: Meta = { icon: Hash, label: '기타', color: C.slate, art: 'other' };

/**
 * 공식 카테고리 11개 — API enum 값과 화면 표기(`@studyclub/mock` 의 `CATEGORY_DISPLAY`) 둘 다 받는다.
 * 앱은 보통 표기로 바꿔서 넘기지만, enum 값이 그대로 와도 같은 결과가 나와야 한다.
 */
const CANONICAL: Record<string, Meta> = {
  ai_ml: AI_ML,
  'ai · ml': AI_ML,
  algorithm: ALGORITHM,
  알고리즘: ALGORITHM,
  data: DATA,
  데이터: DATA,
  software: SOFTWARE,
  '소프트웨어 개발': SOFTWARE,
  career: CAREER,
  커리어: CAREER,
  book_club: BOOK_CLUB,
  북클럽: BOOK_CLUB,
  language: LANGUAGE,
  어학: LANGUAGE,
  lifestyle: LIFESTYLE,
  라이프스타일: LIFESTYLE,
  product: PRODUCT,
  '기획 · pm': PRODUCT,
  business: BUSINESS,
  비즈니스: BUSINESS,
  other: OTHER,
  기타: OTHER,
};

/**
 * 공식 목록에 없는 값(카테고리가 고정되기 전 자유입력 데이터)만 키워드로 추정한다.
 *
 * ⚠️ 배열 순서 = 우선순위. 위에서부터 첫 일치를 쓰므로 **구체적인 것이 위**, 포괄적인 것이 아래다.
 * 영문 키워드는 단어 단위로만 맞춘다 — 그냥 포함 여부로 보면 `lifestyle` 안의 `fe` 가 FE 로 걸린다.
 */
const LEGACY_RULES: (Meta & { match: string[] })[] = [
  {
    ...AI_ML,
    match: ['ai · ml', 'ai', 'ml', 'ai/ml', '머신러닝', '딥러닝', 'llm', '논문', 'kaggle', '캐글', 'causal', '인과'],
  },
  { ...ALGORITHM, match: ['cs', 'algorithm', 'leetcode', '리트코드', 'neetcode', '코테', '자료구조'] },
  { ...DATA, match: ['데이터', 'data', 'sql', 'db', '디비'] },
  {
    icon: Server,
    label: '백엔드',
    color: C.indigo,
    art: 'backend',
    match: ['백엔드', 'backend', 'spring', 'django', 'express', 'nest'],
  },
  {
    icon: Monitor,
    label: '프론트엔드',
    color: C.blue,
    art: 'frontend',
    match: ['프론트엔드', 'frontend', 'react', 'vue', 'angular', 'next'],
  },
  {
    icon: Smartphone,
    label: '모바일',
    color: C.teal,
    art: 'mobile',
    match: ['모바일', 'mobile', 'ios', 'android', 'flutter', 'swift', 'kotlin'],
  },
  { ...PRODUCT, match: ['기획', 'planning', '프로덕트', 'product', '그로스', 'growth'] },
  { icon: Package, label: 'PM', color: C.violet, art: 'product', match: ['pm', '프로젝트 매니'] },
  { icon: Palette, label: '디자인', color: C.rose, art: 'design', match: ['디자인', 'design', 'figma', 'ui', 'ux'] },
  { ...CAREER, match: ['커리어', 'career', '취업', 'resume', '이력서', 'interview', '인터뷰', '면접'] },
  { ...BUSINESS, match: ['비즈니스', 'business', 'article', '아티클', '시장', '산업'] },
  { ...BOOK_CLUB, match: ['북클럽', 'book', '독서', '리딩'] },
  { ...LANGUAGE, match: ['어학', 'language', '언어', '영어', '중국어', '독일어', 'german', 'english', 'chinese'] },
  {
    ...LIFESTYLE,
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
  },
  // 아래는 포괄 항목 — 위에서 안 걸린 것만 받는다
  {
    ...SOFTWARE,
    match: [
      '소프트웨어 개발',
      '코딩',
      'coding',
      '개발',
      'dev',
      '클라우드',
      'cloud',
      '보안',
      'security',
      'golang',
      'redis',
    ],
  },
  { ...OTHER, match: ['기타', 'etc', 'other'] },
];

// 규칙에 안 걸리는 값은 팔레트에서 순환 배정 — 같은 값이면 항상 같은 색.
const FALLBACK: Duo[] = [C.indigo, C.teal, C.amber, C.rose, C.violet, C.blue, C.emerald, C.slate];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function hasKeyword(key: string, word: string): boolean {
  if (!/^[a-z0-9]+$/.test(word)) return key.includes(word);
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(key);
}

function pick(category?: string): Meta {
  const key = (category ?? '').trim().toLowerCase();
  const canonical = CANONICAL[key];
  if (canonical) return canonical;
  for (const { match, ...meta } of LEGACY_RULES) if (match.some((m) => hasKeyword(key, m))) return meta;
  const label = (category ?? '스터디').trim().slice(0, 12);
  return { icon: Hash, label, color: FALLBACK[hash(label) % FALLBACK.length]! };
}

/** 카테고리 → 아이콘·라벨·색. 카드 헤더에서 재사용. */
export function categoryMeta(category?: string): Meta {
  return pick(category);
}

/** 카테고리 스팟 이미지 URL. 없는 카테고리(자유입력 fallback)는 undefined — 그때는 lucide 아이콘을 쓴다. */
export function categoryArtUrl(category?: string): string | undefined {
  const { art } = pick(category);
  return art ? `/study-art/study-${art}.webp` : undefined;
}

/**
 * 카테고리 옅은 틴트 바탕 + 진한 글자색. 카드 헤더용.
 * 진한 그라디언트 위에 인디고 3D 스팟 이미지를 얹으면 서로 싸워 탁해 보인다(2026-10-18 stage 캡처) —
 * 바탕을 밝게 두고 카테고리 색은 글자·옅은 면으로만 남긴다.
 */
export function categoryTint(category?: string): { background: string; ink: string } {
  const [from, to] = pick(category).color;
  return {
    background: `linear-gradient(135deg, color-mix(in oklab, ${to} 10%, white), color-mix(in oklab, ${to} 24%, white))`,
    ink: from,
  };
}

/** 카테고리 색 그라디언트 CSS 값. */
export function categoryGradient(category?: string): string {
  const [from, to] = pick(category).color;
  return `linear-gradient(120deg, ${from}, ${to})`;
}

export interface StudyThumbProps {
  image?: string;
  category?: string;
  className?: string;
}

/**
 * 스터디 썸네일. 이미지가 있으면 그대로, 없으면 카테고리 기반 그라디언트 fallback.
 * 카테고리 색·아이콘은 `categoryMeta` / `categoryGradient` 로 분리해 카드 헤더에서도 쓸 수 있다.
 */
export function StudyThumb({ image, category, className = '' }: StudyThumbProps) {
  const base = 'relative w-full aspect-[16/6] overflow-hidden';

  if (image?.trim()) {
    return <img src={image} alt='' className={`${base} object-cover ${className}`} />;
  }

  const { icon: Icon, label } = pick(category);
  const artUrl = categoryArtUrl(category);
  const { background, ink } = categoryTint(category);
  return (
    <div className={`${base} flex items-center gap-3 px-5 ${className}`} style={{ background }} aria-hidden='true'>
      {artUrl ? (
        <span
          className='pointer-events-none absolute right-3 top-1/2 aspect-square h-[92%] -translate-y-1/2 bg-contain bg-center bg-no-repeat'
          style={{ backgroundImage: `url(${artUrl})` }}
        />
      ) : (
        <Icon className='pointer-events-none absolute -right-3 -bottom-4 opacity-15' style={{ color: ink }} size={104} strokeWidth={1.25} />
      )}
      <Icon className='relative shrink-0' style={{ color: ink }} size={22} strokeWidth={1.75} />
      <span className='relative text-sm font-semibold' style={{ color: ink }}>
        {label}
      </span>
    </div>
  );
}
