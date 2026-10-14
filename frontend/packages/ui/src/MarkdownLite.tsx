import type { ReactNode } from 'react';

const HEADER_CLASS: Record<number, string> = {
  1: 'text-lg font-bold',
  2: 'text-base font-bold',
  3: 'text-sm font-bold',
  4: 'text-sm font-semibold',
  5: 'text-sm font-semibold',
  6: 'text-xs font-semibold',
};

/**
 * 인라인 마크다운을 치환한다.
 * 지원: 이미지 · 링크 · 인라인 코드 · 굵게 · 취소선 · 기울임.
 */
function formatInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex =
    /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      nodes.push(<img key={key} src={m[2]} alt={m[1]} className='my-1 max-w-full rounded-control' />);
    } else if (m[3] !== undefined) {
      const href = m[4].trim();
      const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/');
      if (isSafe) {
        nodes.push(
          <a key={key} href={href} target='_blank' rel='noreferrer noopener' className='text-brand underline underline-offset-2'>
            {m[3]}
          </a>,
        );
      } else {
        nodes.push(<span key={key}>{m[3]}</span>);
      }
    } else if (m[5] !== undefined) {
      nodes.push(
        <code key={key} className='rounded-xs bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]'>
          {m[5]}
        </code>,
      );
    } else if (m[6] !== undefined || m[7] !== undefined) {
      nodes.push(<strong key={key}>{m[6] ?? m[7]}</strong>);
    } else if (m[8] !== undefined) {
      nodes.push(<del key={key}>{m[8]}</del>);
    } else {
      nodes.push(<em key={key}>{m[9] ?? m[10]}</em>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * 설문·공지 설명용 경량 마크다운 렌더러.
 * 지원: 제목(`#`~`######`) · 굵게/기울임/취소선 · 순서·비순서 목록 · 링크·이미지 · 인라인·펜스 코드.
 */
export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let codeBuffer: string[] | null = null;

  const flushList = (key: string) => {
    if (!listBuffer.length || !listType) return;
    const Tag = listType;
    blocks.push(
      <Tag key={key} className={Tag === 'ul' ? 'list-disc space-y-0.5 pl-5' : 'list-decimal space-y-0.5 pl-5'}>
        {listBuffer.map((item, idx) => (
          <li key={idx}>{formatInline(item, `${key}-${idx}`)}</li>
        ))}
      </Tag>,
    );
    listBuffer = [];
    listType = null;
  };

  text.split('\n').forEach((line, idx) => {
    if (/^```/.test(line)) {
      if (codeBuffer === null) {
        flushList(`list-${idx}`);
        codeBuffer = [];
      } else {
        blocks.push(
          <pre key={`code-${idx}`} className='overflow-x-auto rounded-control bg-surface-2 px-3 py-2 text-xs'>
            <code className='font-mono'>{codeBuffer.join('\n')}</code>
          </pre>,
        );
        codeBuffer = null;
      }
      return;
    }
    if (codeBuffer !== null) {
      codeBuffer.push(line);
      return;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList(`list-${idx}`);
      const level = heading[1].length;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      blocks.push(
        <Tag key={`h-${idx}`} className={HEADER_CLASS[level]}>
          {formatInline(heading[2], `h-${idx}`)}
        </Tag>,
      );
      return;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (ordered) {
      if (listType === 'ul') flushList(`list-${idx}`);
      listType = 'ol';
      listBuffer.push(ordered[1]);
      return;
    }
    if (bullet) {
      if (listType === 'ol') flushList(`list-${idx}`);
      listType = 'ul';
      listBuffer.push(bullet[1]);
      return;
    }

    flushList(`list-${idx}`);
    if (line.trim() === '') return;
    blocks.push(<p key={`p-${idx}`}>{formatInline(line, `p-${idx}`)}</p>);
  });
  flushList('list-end');
  return <div className={className}>{blocks}</div>;
}
