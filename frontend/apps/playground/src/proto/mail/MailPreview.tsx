'use client';

import { useMemo, useState } from 'react';

import { Textarea, cx } from '@studyclub/ui';

import { type MailTemplate, isHtml, placeholders, renderTemplate, toPreviewDocument } from './render';

/** 플레이스홀더마다 넣어 볼 예시 값. 모르는 키는 키 이름을 그대로 넣는다. */
const SAMPLE: Record<string, string> = { nickname: '스터디메이트' };

function samplePayload(t: MailTemplate): string {
  const payload = Object.fromEntries(placeholders(t.subject, t.body).map((k) => [k, SAMPLE[k] ?? k]));
  return JSON.stringify(payload, null, 2);
}

export function MailPreview({ templates }: { templates: MailTemplate[] }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id);
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const [payloadText, setPayloadText] = useState(() => (selected ? samplePayload(selected) : '{}'));

  const parsed = useMemo(() => {
    try {
      const value: unknown = JSON.parse(payloadText);
      if (value && typeof value === 'object' && !Array.isArray(value)) return { payload: value as Record<string, unknown> };
      return { error: '{ "키": "값" } 모양의 객체여야 해요' };
    } catch {
      return { error: 'JSON 형식이 맞지 않아요' };
    }
  }, [payloadText]);

  if (!selected) return null;
  const payload = parsed.payload ?? {};

  const select = (t: MailTemplate) => {
    setSelectedId(t.id);
    setPayloadText(samplePayload(t));
  };

  return (
    <div className='grid gap-6 lg:grid-cols-[16rem_1fr]'>
      <aside className='flex flex-col gap-1'>
        {templates.map((t) => (
          <button
            key={t.id}
            type='button'
            onClick={() => select(t)}
            className={cx(
              'flex flex-col items-start gap-1 rounded-card px-3 py-2.5 text-left transition-colors',
              t.id === selected.id ? 'bg-primary-light' : 'hover:bg-cloud',
            )}
          >
            <span className='text-sm font-semibold text-ink'>{t.eventType}</span>
            <span className='text-xs text-fg-muted'>
              {t.channel} · {isHtml(t.body) ? 'HTML' : '텍스트'}
            </span>
          </button>
        ))}
      </aside>

      <section className='flex min-w-0 flex-col gap-4'>
        <div className='flex flex-col gap-1'>
          <span className='text-xs text-fg-muted'>제목</span>
          <p className='text-lg font-semibold text-ink'>{renderTemplate(selected.subject, payload)}</p>
          <span className='text-xs text-fg-muted'>
            마지막 수정 {new Date(selected.updatedAt).toLocaleString('ko-KR')} ·{' '}
            {isHtml(selected.body) ? 'HTML 본문' : '텍스트 본문 (text/plain 으로 나간다)'}
          </span>
        </div>

        <div className='grid gap-4 xl:grid-cols-[1fr_18rem]'>
          {/* sandbox 비움 = 스크립트·폼·팝업 전부 막는다. 메일 클라이언트도 스크립트를 돌리지 않는다 */}
          <iframe
            title='메일 미리보기'
            sandbox=''
            srcDoc={toPreviewDocument(renderTemplate(selected.body, payload))}
            className='h-[44rem] w-full rounded-card border border-border bg-white'
          />
          <Textarea
            label='예시 값 (JSON)'
            helper='플레이스홀더 {{키}} 가 이 값으로 바뀐다. 서버 렌더러와 같은 규칙이다'
            error={parsed.error}
            rows={8}
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            className='font-mono text-sm'
            spellCheck={false}
          />
        </div>
      </section>
    </div>
  );
}
