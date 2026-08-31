import type { Locale } from '@core/lib/content';
import { LEGAL_TEXT, lx, type Block, type LegalDocument, type LegalSection } from '@core/lib/legal';

/**
 * 이용약관·개인정보처리방침 공용 화면.
 *
 * 두 문서는 성격이 달라도 **읽는 방식이 같다** — 제목·최종 개정일·목차·조항 순서대로.
 * 화면을 따로 만들면 한쪽만 고쳐져 두 문서의 생김새가 갈린다.
 */
export function LegalDoc({ doc, locale }: { doc: LegalDocument; locale: Locale }) {
  return (
    <div className='mx-auto max-w-3xl px-6 py-14'>
      <header data-anno='1'>
        <h1 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>{lx(doc.title, locale)}</h1>
        <p data-anno='1-1' className='mt-3 text-sm text-(--color-fg-muted)'>
          {lx(LEGAL_TEXT.updatedAt, locale)} <time dateTime={doc.updatedAt}>{doc.updatedAt}</time>
        </p>
      </header>

      {doc.intro?.length ? (
        <div className='mt-8 flex flex-col gap-3'>
          {doc.intro.map((b, i) => (
            <BlockView key={i} block={b} locale={locale} />
          ))}
        </div>
      ) : null}

      <nav data-anno='2' className='mt-10 rounded-card border border-(--color-border) px-6 py-5'>
        <h2 className='text-sm font-bold'>{lx(LEGAL_TEXT.toc, locale)}</h2>
        {groupByChapter(doc.sections).map((g, gi) => (
          <div key={gi} className={gi === 0 ? 'mt-3' : 'mt-4'}>
            {g.chapter ? (
              <div className='text-[13px] font-semibold text-(--color-fg-subtle)'>{lx(g.chapter, locale)}</div>
            ) : null}
            <ol className={`flex flex-col gap-1.5 text-sm text-(--color-fg-muted) ${g.chapter ? 'mt-1.5' : ''}`}>
              {g.sections.map((sec) => (
                <li key={sec.id}>
                  <a href={`#${sec.id}`} className='underline-offset-4 hover:text-(--color-fg) hover:underline'>
                    {lx(sec.heading, locale)}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </nav>

      <div data-anno='3' className='mt-10 flex flex-col gap-10'>
        {doc.sections.map((s, i) => (
          <section key={s.id} id={s.id} className='scroll-mt-24'>
            {s.chapter && s.chapter.ko !== doc.sections[i - 1]?.chapter?.ko ? (
              <h2 className='mb-6 border-b border-(--color-border) pb-2 text-sm font-bold text-(--color-fg-subtle)'>
                {lx(s.chapter, locale)}
              </h2>
            ) : null}
            <h2 className='text-lg font-bold tracking-tight'>{lx(s.heading, locale)}</h2>
            {s.blocks?.length ? (
              <div className='mt-3 flex flex-col gap-3'>
                {s.blocks.map((b, i) => (
                  <BlockView key={i} block={b} locale={locale} />
                ))}
              </div>
            ) : (
              <p className='mt-2 text-[15px] italic text-(--color-fg-faint)'>{lx(LEGAL_TEXT.empty, locale)}</p>
            )}
          </section>
        ))}
      </div>

    </div>
  );
}

const TEXT = 'text-[15px] leading-relaxed text-(--color-fg-muted)';

function BlockView({ block, locale }: { block: Block; locale: Locale }) {
  switch (block.kind) {
    case 'p':
      // 원문에서 굵게 강조된 문단 — 면책·책임 한계처럼 놓치면 안 되는 조항이다.
      return (
        <p className={block.strong ? 'text-[15px] font-semibold leading-relaxed text-(--color-fg)' : TEXT}>
          {lx(block.text, locale)}
        </p>
      );

    case 'ul':
      return (
        <ul className={`list-disc space-y-1.5 pl-5 ${TEXT}`}>
          {block.items.map((t, i) => (
            <li key={i}>{lx(t, locale)}</li>
          ))}
        </ul>
      );

    case 'ol':
      // 각 호는 한 단계 들여쓴다. 항 번호(1. 2. 3.)와 호 번호가 같은 왼쪽 선에 서면
      // 어디까지가 상위 항인지 읽는 사람이 못 가른다.
      return (
        <ol className={`list-decimal space-y-1.5 ${block.sub ? 'ml-5 pl-5' : 'pl-5'} ${TEXT}`}>
          {block.items.map((t, i) => (
            <li key={i}>{lx(t, locale)}</li>
          ))}
        </ol>
      );

    case 'steps':
      return (
        <ol className={`list-decimal space-y-2.5 pl-5 ${TEXT}`}>
          {block.items.map((it, i) => (
            <li key={i}>
              <span className='font-bold text-(--color-fg)'>{lx(it.title, locale)}</span>
              <br />
              {lx(it.body, locale)}
            </li>
          ))}
        </ol>
      );

    case 'table':
      // 조항 표는 칸이 최대 7개까지 간다(국외 이전). 좁은 화면에서 줄바꿈으로 뭉개지는 대신
      // 표 자체를 가로 스크롤시킨다 — 법률 문서는 열 대응이 흐트러지면 읽을 수 없다.
      return (
        <div className='-mx-1 overflow-x-auto px-1'>
          <table className='w-full min-w-full border-collapse text-[13px]'>
            <thead>
              <tr className='border-b border-(--color-border) text-left text-(--color-fg-subtle)'>
                {block.head.map((h, i) => (
                  <th key={i} className='whitespace-nowrap px-3 py-2 font-semibold'>
                    {lx(h, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className='border-b border-(--color-border) last:border-0'>
                  {row.map((c, ci) => (
                    <td key={ci} className='px-3 py-2.5 align-top text-(--color-fg-muted)'>
                      {lx(c, locale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'note':
      return (
        <p
          className='rounded-card border-l-2 bg-(--color-surface-subtle) py-3 pl-4 pr-4 text-[14px] leading-relaxed text-(--color-fg-muted)'
          style={{ borderLeftColor: 'var(--color-border-strong)' }}
        >
          {lx(block.text, locale)}
        </p>
      );

  }
}

/** 목차를 장 단위로 묶는다. 장이 없는 문서는 한 덩어리로 남는다. */
function groupByChapter(sections: LegalSection[]): { chapter?: LegalSection['chapter']; sections: LegalSection[] }[] {
  const out: { chapter?: LegalSection['chapter']; sections: LegalSection[] }[] = [];
  for (const s of sections) {
    const last = out[out.length - 1];
    if (last && last.chapter?.ko === s.chapter?.ko) last.sections.push(s);
    else out.push({ chapter: s.chapter, sections: [s] });
  }
  return out;
}
