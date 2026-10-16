'use client';

import { useRef, useState } from 'react';

import { Button, Segmented, cx } from '@studyclub/ui';

import { renderTemplate, toPreviewDocument } from './render';
import type { MailTemplateMeta } from './templates';

type Template = MailTemplateMeta & { html: string };

const WIDTHS = [
  { value: '600', label: '600px' },
  { value: '375', label: '375px' },
];

/** 디자이너용 HTML 편집기 — 고친 값은 메모리에만 있다. 새로고침하면 시안 파일로 돌아간다. */
export function MailEditor({ templates }: { templates: Template[] }) {
  const [key, setKey] = useState(templates[0]?.key);
  const selected = templates.find((t) => t.key === key) ?? templates[0];
  // 템플릿마다 고친 HTML — 다른 템플릿을 보고 와도 고친 것이 남는다
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [width, setWidth] = useState('600');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!selected) return null;
  const html = edits[selected.key] ?? selected.html;
  const dirty = html !== selected.html;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 권한이 없으면(http 등) 전체 선택해 두고 ⌘C 를 맡긴다
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  };

  return (
    <div className='grid gap-4 xl:grid-cols-[14rem_minmax(0,1fr)_auto]'>
      <aside className='flex flex-col gap-1'>
        {templates.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => setKey(t.key)}
            className={cx(
              'flex flex-col items-start gap-1 rounded-card px-3 py-2.5 text-left transition-colors',
              t.key === selected.key ? 'bg-primary-light' : 'hover:bg-cloud',
            )}
          >
            <span className='text-sm font-semibold text-ink'>
              {t.name}
              {edits[t.key] !== undefined && edits[t.key] !== t.html ? ' •' : ''}
            </span>
            <span className='text-xs text-fg-muted'>{t.subject}</span>
          </button>
        ))}
      </aside>

      <section className='flex min-w-0 flex-col gap-2'>
        <div className='flex items-center justify-between gap-2'>
          <span className='font-mono text-xs text-fg-muted'>{selected.key}.html</span>
          <div className='flex items-center gap-2'>
            {copied && <span className='text-xs text-fg-muted'>복사했어요</span>}
            <Button
              size='sm'
              variant='ghost'
              disabled={!dirty}
              onClick={() =>
                setEdits((prev) => {
                  const next = { ...prev };
                  delete next[selected.key];
                  return next;
                })
              }
            >
              원본으로
            </Button>
            <Button size='sm' variant='secondary' onClick={copy}>
              HTML 복사
            </Button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          aria-label='HTML 소스'
          value={html}
          onChange={(e) => setEdits((prev) => ({ ...prev, [selected.key]: e.target.value }))}
          spellCheck={false}
          className='h-[48rem] w-full resize-none rounded-card border border-border bg-white p-3 font-mono text-xs leading-5 text-ink focus:border-primary focus:outline-none'
        />
        <p className='text-xs text-fg-muted'>
          고친 HTML 은 저장되지 않는다 — 반영은 시안 파일 PR → V{'{n}'} 마이그레이션.
        </p>
      </section>

      <section className='flex flex-col gap-2'>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-xs text-fg-muted'>미리보기 · 예시 값 {JSON.stringify(selected.sample)}</span>
          <Segmented size='sm' options={WIDTHS} value={width} onChange={setWidth} />
        </div>
        <div className='rounded-card border border-border bg-white px-4 py-3'>
          <span className='text-xs text-fg-muted'>제목</span>
          <p className='text-sm font-semibold text-ink'>{renderTemplate(selected.subject, selected.sample)}</p>
        </div>
        {/* sandbox 비움 = 스크립트·폼·팝업 전부 막는다. 메일 클라이언트도 스크립트를 돌리지 않는다 */}
        <iframe
          title='메일 미리보기'
          sandbox=''
          srcDoc={toPreviewDocument(renderTemplate(html, selected.sample))}
          style={{ width: `${width}px` }}
          className='h-[44rem] max-w-full rounded-card border border-border bg-white'
        />
      </section>
    </div>
  );
}
