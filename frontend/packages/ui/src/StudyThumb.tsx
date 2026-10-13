import {
  BookOpen,
  Brain,
  Briefcase,
  Code2,
  Database,
  Hash,
  Languages,
  MessagesSquare,
  Package,
  Puzzle,
  Sunrise,
  type LucideIcon,
} from 'lucide-react';

type Duo = [string, string];

const C = {
  indigo: ['color-mix(in oklab, var(--color-chart-1) 60%, black)', 'var(--color-chart-1)'] as Duo,
  violet: ['color-mix(in oklab, var(--color-chart-4) 60%, black)', 'var(--color-chart-4)'] as Duo,
  blue:   ['color-mix(in oklab, var(--color-chart-1) 70%, black)', 'var(--color-chart-1)'] as Duo,
  teal:   ['color-mix(in oklab, var(--color-chart-3) 60%, black)', 'var(--color-chart-3)'] as Duo,
  emerald:['color-mix(in oklab, var(--color-chart-5) 60%, black)', 'var(--color-chart-5)'] as Duo,
  amber:  ['color-mix(in oklab, var(--color-chart-2) 60%, black)', 'var(--color-chart-2)'] as Duo,
  rose:   ['color-mix(in oklab, var(--color-chart-6) 60%, black)', 'var(--color-chart-6)'] as Duo,
  slate:  ['var(--color-neutral-800)', 'var(--color-neutral-600)'] as Duo,
};

const RULES: { match: string[]; icon: LucideIcon; label: string; color: Duo }[] = [
  {
    match: ['ai&ml','ai · ml','ai/ml','ai','ml','머신러닝','딥러닝','llm','논문','kaggle','캐글','causal','인과'],
    icon: Brain, label: 'AI&ML', color: C.violet,
  },
  {
    match: ['cs(컴퓨터 사이언스)','알고리즘','algorithm','leetcode','리트코드','neetcode','코테'],
    icon: Puzzle, label: 'CS', color: C.blue,
  },
  { match: ['데이터 사이언스','데이터','data','sql','db','디비'], icon: Database, label: 'DATA SCIENCE', color: C.teal },
  { match: ['fe','프론트','frontend','react','ui','ux'], icon: Code2, label: 'FE', color: C.indigo },
  { match: ['모바일 프로그래밍','모바일','mobile','ios','android'], icon: Code2, label: 'MOBILE', color: C.blue },
  {
    match: ['기획','기획 · pm','pm','프로덕트','product','그로스','growth'],
    icon: Package, label: '기획', color: C.violet,
  },
  {
    match: ['취업','커리어','career','이력서','resume','인터뷰','interview','면접'],
    icon: MessagesSquare, label: '취업', color: C.amber,
  },
  { match: ['디자인','design','디자이너','figma'], icon: Package, label: 'DESIGN', color: C.rose },
  {
    match: ['비즈니스','business','아티클','article','시장','산업'],
    icon: Briefcase, label: 'BUSINESS', color: C.slate,
  },
  { match: ['교양','북클럽','book','독서','리딩'], icon: BookOpen, label: 'LIFESTYLE', color: C.amber },
  {
    match: ['어학','언어','language','영어','중국어','독일어','german','english','chinese'],
    icon: Languages, label: 'LANGUAGE', color: C.emerald,
  },
  {
    match: ['라이프스타일','lifestyle','습관','habit','회고','retro','네트워킹','network','커피챗','밋업','meetup'],
    icon: Sunrise, label: 'LIFESTYLE', color: C.rose,
  },
  {
    match: ['be','소프트웨어 개발','코딩','coding','개발','dev','백엔드','backend','클라우드','cloud','보안','security'],
    icon: Code2, label: 'BE', color: C.indigo,
  },
  { match: ['기타','etc','other'], icon: Hash, label: 'ETC', color: C.slate },
];

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
  return { icon: Hash, label, color: FALLBACK[hash(label) % FALLBACK.length]! };
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

  const { icon: Icon, label, color } = pick(category);
  const [from, to] = color;

  return (
    <div
      className={`${base} flex items-center gap-3 px-5 ${className}`}
      style={{ background: `linear-gradient(120deg, ${from}, ${to})` }}
      aria-hidden='true'
    >
      <Icon className='pointer-events-none absolute -right-3 -bottom-4 text-white/15' size={104} strokeWidth={1.25} />
      <Icon className='relative shrink-0 text-white' size={22} strokeWidth={1.75} />
      <span className='relative text-[13px] font-bold uppercase tracking-[0.14em] text-white/90'>{label}</span>
    </div>
  );
}
