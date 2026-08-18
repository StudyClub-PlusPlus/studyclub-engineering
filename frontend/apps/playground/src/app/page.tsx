import Link from "next/link";

const ENTRIES = [
  {
    href: "/components",
    title: "컴포넌트 카탈로그",
    body: "@studyclub/ui 에 있는 컴포넌트를 상태별로 늘어놓은 곳. 「그 배지 뭐뭐 있죠?」를 링크로 답하는 용도.",
  },
  {
    href: "/screens/study-detail",
    title: "화면 · 스터디 상세",
    body: "실제 컴포넌트로 조립한 화면 시안. 새 화면을 만들 때 이 폴더를 복사해서 시작한다.",
  },
];

export default function PlaygroundIndex() {
  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-tight">디자인 playground</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-[var(--color-fg-muted)]">
        실제 프로덕션 컴포넌트(<code className="rounded bg-[var(--color-surface-subtle)] px-1.5 py-0.5 text-[13px]">@studyclub/ui</code>)로
        화면을 조립해 보는 곳입니다. 여기서 무엇을 깨뜨려도 <strong>studyclub-plusplus.com 배포는 영향을 받지 않습니다</strong> —
        마음껏 고치세요.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {ENTRIES.map((e) => (
          <Link key={e.href} href={e.href} className="card card-hover block p-6">
            <h2 className="text-lg font-bold">{e.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-fg-subtle)]">{e.body}</p>
          </Link>
        ))}
      </div>

      <section className="card mt-10 p-6">
        <h2 className="text-base font-bold">화면을 하나 추가하려면</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--color-fg-muted)]">
          <li><code>src/app/screens/study-detail/</code> 폴더를 통째로 복사해 새 이름을 붙입니다</li>
          <li><code>page.tsx</code> 안을 고칩니다 — 컴포넌트는 <code>@studyclub/ui</code> 에서 가져옵니다</li>
          <li>이 페이지의 <code>ENTRIES</code> 배열에 링크를 한 줄 추가합니다</li>
          <li><code>beta</code> 브랜치로 PR 을 올립니다</li>
        </ol>
        <p className="mt-3 text-sm text-[var(--color-fg-subtle)]">
          자세한 명령은 <code>apps/playground/README.md</code> 에 복붙 가능한 형태로 있습니다.
        </p>
      </section>
    </div>
  );
}
