// 스터디/행사 썸네일 — 이미지가 있으면 그대로, 없으면 결정론적 그라디언트 + 이모지 fallback.
// 외부 의존/네트워크 없음. seed 해시로 색을 뽑아 SSR/CSR 이 항상 동일하게 렌더된다. (server component)

// 카테고리(한/영) → 이모지. 키워드 부분매칭으로 태그 문자열도 넓게 커버.
const EMOJI_RULES: { match: string[]; emoji: string }[] = [
  { match: ["ai", "ml", "머신러닝", "딥러닝", "llm", "논문", "kaggle", "캐글"], emoji: "🤖" },
  { match: ["알고리즘", "algorithm", "leetcode", "리트코드", "neetcode", "코테"], emoji: "🧩" },
  { match: ["인터뷰", "interview", "면접"], emoji: "💬" },
  { match: ["북클럽", "book", "독서", "리딩", "아티클", "article"], emoji: "📚" },
  { match: ["보안", "security", "웹보안"], emoji: "🔐" },
  { match: ["데이터", "data", "sql"], emoji: "📊" },
  { match: ["코딩", "coding", "개발", "dev"], emoji: "⌨️" },
  { match: ["언어", "language", "영어", "중국어", "독일어", "german", "english", "chinese"], emoji: "🌐" },
  { match: ["회고", "retro"], emoji: "🪞" },
  { match: ["습관", "habit"], emoji: "⏰" },
  { match: ["프론트", "frontend", "ui", "react"], emoji: "🎨" },
  { match: ["백엔드", "backend", "redis", "레디스", "golang", "go "], emoji: "🛠️" },
  { match: ["클라우드", "cloud", "aws"], emoji: "☁️" },
  { match: ["프로덕트", "product", "그로스", "growth"], emoji: "📦" },
  { match: ["네트워킹", "network", "커피챗", "밋업", "meetup"], emoji: "🤝" },
];

function pickEmoji(category?: string, emoji?: string): string {
  if (emoji) return emoji;
  const key = (category ?? "").toLowerCase();
  for (const rule of EMOJI_RULES) {
    if (rule.match.some((m) => key.includes(m))) return rule.emoji;
  }
  return "✨";
}

// 문자열 → 안정적 정수 해시 (char code 합 기반).
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function StudyThumb({
  image,
  seed,
  category,
  emoji,
  className = "",
}: {
  image?: string;
  seed: string;
  category?: string;
  emoji?: string;
  className?: string;
}) {
  const base = "relative w-full aspect-[16/9] overflow-hidden rounded-t-2xl";

  if (image && image.trim() !== "") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" className={`${base} object-cover ${className}`} />
    );
  }

  const h = hash(seed);
  const hue = h % 360;
  const hue2 = (hue + 42) % 360;
  const glyph = pickEmoji(category, emoji);
  const watermark = (category ?? seed).trim().charAt(0).toUpperCase();

  return (
    <div
      className={`${base} grid place-items-center ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 62% 58%), hsl(${hue2} 58% 44%))`,
      }}
      aria-hidden="true"
    >
      {/* 텍스처용 은은한 첫 글자 워터마크 */}
      <span
        className="pointer-events-none absolute -right-2 -bottom-6 select-none font-black leading-none text-white/10"
        style={{ fontSize: "8rem" }}
      >
        {watermark}
      </span>
      <span className="relative select-none text-5xl drop-shadow-sm">{glyph}</span>
    </div>
  );
}
