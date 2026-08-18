import Link from "next/link";

const ENTRIES = [
  {
    href: "/components",
    title: "컴포넌트 카탈로그",
    body: "@studyclub/ui 프리미티브를 상태별로 늘어놓은 곳. 정적 목업이 아니라 실제 React 컴포넌트라 코드와 어긋나지 않는다.",
  },
  {
    href: "/screens/study-detail",
    title: "화면 · 스터디 상세",
    body: "프리미티브로 조립한 화면 시안. 새 화면을 만들 때 이 폴더를 복사해서 시작한다.",
  },
];

export default function PlaygroundIndex() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">디자인 playground</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-[var(--color-fg-muted)]">
        실제 프로덕션 컴포넌트로 화면을 조립해 보는 곳입니다. 여기서 무엇을 깨뜨려도{" "}
        <strong>studyclub-plusplus.com 배포는 영향을 받지 않습니다</strong> — 마음껏 고치세요.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ENTRIES.map((e) => (
          <Link key={e.href} href={e.href} className="block">
            <div className="h-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-shadow hover:shadow-md">
              <h2 className="text-lg font-bold">{e.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-muted)]">{e.body}</p>
            </div>
          </Link>
        ))}
      </div>

      <section className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-base font-bold">디자인 시스템 문서와의 관계</h2>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">
          <li>
            <strong>design-system.md</strong> — 규칙의 정본. 색·타이포·간격·접근성 기준을 정한다
          </li>
          <li>
            <strong>styleguide.html</strong> — 손으로 쓴 정적 목업. 의도한 모습을 보여주지만 코드와 갈릴 수 있다
          </li>
          <li>
            <strong>이 playground</strong> — 실제 컴포넌트를 렌더한다. <em>지금 코드가 어떻게 생겼는지</em>가 여기 있다
          </li>
        </ul>
      </section>

      <section className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h2 className="text-base font-bold">화면을 하나 추가하려면</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--color-fg-muted)]">
          <li>
            <code>src/app/screens/study-detail/</code> 폴더를 통째로 복사해 새 이름을 붙입니다
          </li>
          <li>
            <code>page.tsx</code> 안을 고칩니다 — 부품은 <code>@studyclub/ui</code> 에서 가져옵니다
          </li>
          <li>
            이 페이지의 <code>ENTRIES</code> 배열에 링크를 한 줄 추가합니다
          </li>
          <li>
            <code>beta</code> 브랜치로 PR 을 올립니다
          </li>
        </ol>
      </section>
    </div>
  );
}
