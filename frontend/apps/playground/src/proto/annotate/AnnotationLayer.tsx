'use client';

import { useEffect, useRef, useState } from 'react';

import { useAnnotate } from './AnnotateProvider';
import type { AnnoEntry } from './types';

type Hit = {
  n: string;
  rect: { top: number; left: number; width: number; height: number };
};

/** 1 · 1-1 · 1-10 을 사람이 읽는 순서로. 문자열 정렬은 1-10 을 1-2 앞에 둔다. */
function byNumber(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d) return d;
  }
  return 0;
}

export function AnnotationLayer() {
  const { spec, on } = useAnnotate();
  const [hits, setHits] = useState<Hit[]>([]);
  const specRef = useRef(spec);
  specRef.current = spec;

  // 배지는 문서 좌표에 놓는다. 스크롤·리사이즈·펼침 상태 변화를 전부 따라가야 해서
  // 이벤트를 하나씩 거는 대신 켜져 있는 동안 매 프레임 다시 잰다. 요소 20~40개 수준이라 싸다.
  useEffect(() => {
    if (!on) {
      setHits([]);
      return;
    }
    document.body.classList.add('anno-open');
    let raf = 0;
    let prev = '';
    function measure() {
      const next: Hit[] = [];
      const taken = new Set<string>();

      function push(n: string, el: Element) {
        if (taken.has(n)) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        taken.add(n);
        next.push({
          n,
          rect: { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height },
        });
      }

      // selector 로 가리킨 요소를 먼저 잡는다 — data-anno 가 그 안에 들어 있어도
      // 바깥(모달 전체)이 자기 번호를 잃지 않도록.
      specRef.current?.entries.forEach((e) => {
        if (!e.selector) return;
        const el = document.querySelector(e.selector);
        if (el) push(e.n, el);
      });

      document.querySelectorAll('[data-anno]').forEach((el) => {
        const n = el.getAttribute('data-anno');
        if (!n) return;
        // 같은 번호가 여러 번 나오는 건 목록이 반복되기 때문이다(스터디 카드 N장).
        // 번호는 **요소의 종류**에 붙는 것이라 첫 번째에만 배지를 단다 —
        // 카드마다 달면 배지가 겹쳐 읽을 수 없다.
        push(n, el);
      });
      const key = JSON.stringify(next);
      if (key !== prev) {
        prev = key;
        setHits(next);
      }
      raf = requestAnimationFrame(measure);
    }
    raf = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove('anno-open');
    };
  }, [on]);

  if (!on || !spec) return null;

  const entries = [...spec.entries].sort((a, b) => byNumber(a.n, b.n));
  const hitMap = new Map(hits.map((h) => [h.n, h]));
  const specNums = new Set(entries.map((e) => e.n));

  // 스킬의 두 가지 검증을 그대로 화면에 세운다.
  const missing = entries.filter((e) => !hitMap.has(e.n) && !e.when); // 스펙엔 있는데 화면에 없다
  const conditional = entries.filter((e) => !hitMap.has(e.n) && e.when); // 조건이 안 맞아 지금은 안 보인다
  const undocumented = hits.filter((h) => !specNums.has(h.n)); // 화면엔 있는데 스펙에 없다

  return (
    <>
      {/* 배지 + 요소 테두리 */}
      {/* 문서 좌표계 레이어 — 높이 0 이라 레이아웃을 밀지 않는다. 자식이 각자 top/left 를 갖는다. */}
      <div
        className='pointer-events-none z-[60]'
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 0 }}
      >
        {hits.map((h) => {
          const known = specNums.has(h.n);
          const color = known ? 'var(--color-accent)' : 'var(--color-danger-500, #dc2626)';
          return (
            <div key={h.n + h.rect.top}>
              <div
                className='absolute rounded-[4px]'
                style={{
                  top: h.rect.top,
                  left: h.rect.left,
                  width: h.rect.width,
                  height: h.rect.height,
                  outline: `1.5px dashed ${color}`,
                  outlineOffset: 2,
                  background: `color-mix(in oklab, ${color} 6%, transparent)`,
                }}
              />
              <div
                className='absolute grid min-w-[22px] place-items-center rounded-full px-1.5 text-[11px] font-extrabold text-white shadow-sm'
                style={{
                  top: h.rect.top - 10,
                  left: h.rect.left - 10,
                  height: 22,
                  background: color,
                }}
              >
                {h.n}
              </div>
            </div>
          );
        })}
      </div>

      {/* 번호별 명세 패널 */}
      <aside
        className='fixed top-0 right-0 z-[70] flex h-screen w-[380px] flex-col border-l bg-[var(--color-surface)] shadow-lg'
        style={{ borderColor: 'var(--color-border)' }}
      >
        <header className='border-b px-5 py-4' style={{ borderColor: 'var(--color-border)' }}>
          <div className='text-[11px] font-semibold text-[var(--color-fg-subtle)]'>설명</div>
          <h2 className='mt-0.5 text-base font-bold'>{spec.screen}</h2>
          {spec.story ? (
            <div className='mt-1 text-[11px] text-[var(--color-fg-subtle)]'>{spec.story}</div>
          ) : null}
        </header>

        <div className='flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed'>
          {entries.map((e) => (
            <SpecCard key={e.n} entry={e} hit={hitMap.get(e.n)} />
          ))}

          {spec.notes?.length ? (
            <section className='mt-6 rounded-lg border p-3' style={{ borderColor: 'var(--color-border)' }}>
              <h3 className='text-[13px] font-bold'>비고</h3>
              <ul className='mt-1.5 list-disc space-y-1 pl-4 text-[13px] text-[var(--color-fg-muted)]'>
                {spec.notes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {conditional.length > 0 && (
            <p className='mt-4 text-[12px] leading-relaxed text-[var(--color-fg-subtle)]'>
              지금 화면에 없는 조건부 번호 — {conditional.map((e) => e.n).join(', ')}. 탭을 바꾸거나 상태를 만들면 나타난다.
            </p>
          )}

          {(missing.length > 0 || undocumented.length > 0) && (
            <section
              className='mt-6 rounded-lg border p-3'
              style={{ borderColor: 'var(--color-danger-500, #dc2626)' }}
            >
              <h3 className='text-[13px] font-bold' style={{ color: 'var(--color-danger-600, #b91c1c)' }}>
                대조 실패
              </h3>
              {missing.length > 0 && (
                <p className='mt-1.5 text-[12px] leading-relaxed'>
                  <strong>화면에 없는 번호</strong> — {missing.map((e) => e.n).join(', ')}.
                  명세만 있고 붙일 요소가 없다. 화면이 바뀌었거나 <code>data-anno</code> 를 안 달았다.
                </p>
              )}
              {undocumented.length > 0 && (
                <p className='mt-1.5 text-[12px] leading-relaxed'>
                  <strong>명세 없는 번호</strong> — {undocumented.map((h) => h.n).join(', ')}.
                  요소에 번호는 붙었는데 설명이 없다 (미설명 요소).
                </p>
              )}
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

function SpecCard({ entry, hit }: { entry: AnnoEntry; hit?: Hit }) {
  // 표시·동작·정책·데이터는 **쓸 때의 칸**이지 읽을 때의 칸이 아니다.
  // 화면에서는 라벨을 걷어내고 한 덩어리로 읽힌다 — 기획문서를 읽는 감각에 가깝게.
  const lines = [
    ...(entry.display ?? []),
    ...(entry.behavior ?? []),
    ...(entry.policy ?? []),
    ...(entry.data ?? []),
    ...(entry.when ? [`(${entry.when})`] : []),
  ];

  return (
    <section className='mb-5'>
      <h3 className='flex items-center gap-2 text-[13px] font-bold'>
        <span
          className='grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-extrabold text-white'
          style={{ background: hit ? 'var(--color-accent)' : 'var(--color-fg-subtle)' }}
        >
          {entry.n}
        </span>
        {entry.title}
      </h3>
      {lines.length > 0 ? (
        <ul className='mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-[var(--color-fg-muted)]'>
          {lines.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
