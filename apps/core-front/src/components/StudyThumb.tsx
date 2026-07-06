// 스터디/행사 썸네일 — 이미지가 있으면 그대로, 없으면 "디자인된" fallback:
// 큐레이션된 절제 팔레트 + lucide 라인 아이콘 + 카테고리 라벨. (이모지·랜덤 무지개 그라디언트 X)
// 외부 의존/네트워크 없음. seed 해시로 팔레트를 뽑아 SSR/CSR 이 항상 동일. (server component)
import {
  Brain,
  Puzzle,
  MessagesSquare,
  BookOpen,
  ShieldCheck,
  Database,
  Code2,
  Languages,
  RefreshCw,
  Sunrise,
  Palette,
  Server,
  Cloud,
  Package,
  Users,
  Hash,
  type LucideIcon,
} from "lucide-react";

// 카테고리(한/영) → 아이콘 + 라벨. 키워드 부분매칭.
const RULES: { match: string[]; icon: LucideIcon; label: string }[] = [
  { match: ["ai", "ml", "머신러닝", "딥러닝", "llm", "논문", "kaggle", "캐글"], icon: Brain, label: "AI · ML" },
  { match: ["알고리즘", "algorithm", "leetcode", "리트코드", "neetcode", "코테"], icon: Puzzle, label: "ALGORITHM" },
  { match: ["인터뷰", "interview", "면접"], icon: MessagesSquare, label: "INTERVIEW" },
  { match: ["북클럽", "book", "독서", "리딩", "아티클", "article"], icon: BookOpen, label: "READING" },
  { match: ["보안", "security", "웹보안"], icon: ShieldCheck, label: "SECURITY" },
  { match: ["데이터", "data", "sql"], icon: Database, label: "DATA" },
  { match: ["코딩", "coding", "개발", "dev"], icon: Code2, label: "CODING" },
  { match: ["언어", "language", "영어", "중국어", "독일어", "german", "english", "chinese"], icon: Languages, label: "LANGUAGE" },
  { match: ["회고", "retro"], icon: RefreshCw, label: "RETRO" },
  { match: ["습관", "habit"], icon: Sunrise, label: "HABIT" },
  { match: ["프론트", "frontend", "ui", "react"], icon: Palette, label: "FRONTEND" },
  { match: ["백엔드", "backend", "redis", "레디스", "golang", "go "], icon: Server, label: "BACKEND" },
  { match: ["클라우드", "cloud", "aws"], icon: Cloud, label: "CLOUD" },
  { match: ["프로덕트", "product", "그로스", "growth"], icon: Package, label: "PRODUCT" },
  { match: ["네트워킹", "network", "커피챗", "밋업", "meetup"], icon: Users, label: "NETWORK" },
];

function pick(category?: string): { icon: LucideIcon; label: string } {
  const key = (category ?? "").toLowerCase();
  for (const r of RULES) if (r.match.some((m) => key.includes(m))) return { icon: r.icon, label: r.label };
  return { icon: Hash, label: (category ?? "STUDY").toUpperCase().slice(0, 10) };
}

// 큐레이션된 팔레트(무지개 랜덤 대신 톤 정돈). [진한, 옅은] 2톤 대각 그라디언트.
const PALETTE: [string, string][] = [
  ["#4338ca", "#6366f1"], // indigo (brand)
  ["#0f766e", "#14b8a6"], // teal
  ["#b45309", "#f59e0b"], // amber
  ["#9f1239", "#e11d48"], // rose
  ["#6d28d9", "#8b5cf6"], // violet
  ["#1d4ed8", "#3b82f6"], // blue
  ["#047857", "#10b981"], // emerald
  ["#334155", "#64748b"], // slate
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

export function StudyThumb({
  image,
  seed,
  category,
  className = "",
}: {
  image?: string;
  seed: string;
  category?: string;
  emoji?: string;
  className?: string;
}) {
  const base = "relative w-full aspect-[16/6] overflow-hidden";

  if (image && image.trim() !== "") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className={`${base} object-cover ${className}`} />
    );
  }

  const [from, to] = PALETTE[hash(seed) % PALETTE.length];
  const { icon: Icon, label } = pick(category);

  return (
    <div
      className={`${base} flex items-center gap-3 px-5 ${className}`}
      style={{ background: `linear-gradient(120deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      {/* 큰 라인 아이콘 워터마크(우측, 은은) */}
      <Icon
        className="pointer-events-none absolute -right-3 -bottom-4 text-white/15"
        size={104}
        strokeWidth={1.25}
      />
      <Icon className="relative shrink-0 text-white" size={22} strokeWidth={1.75} />
      <span className="relative text-[13px] font-bold uppercase tracking-[0.14em] text-white/90">{label}</span>
    </div>
  );
}
