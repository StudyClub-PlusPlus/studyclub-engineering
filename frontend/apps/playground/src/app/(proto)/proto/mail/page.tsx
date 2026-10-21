import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MailEditor } from '@/proto/mail/MailEditor';
import { MAIL_TEMPLATES } from '@/proto/mail/templates';

export const metadata = { title: '메일 템플릿' };

// 빌드 때 한 번 그린다 — 시안 HTML 은 이때 페이지에 박힌다. 도커(standalone)에는 src 가 없어 런타임에 파일을 못 읽는다
export const dynamic = 'force-static';

const DIR = join(process.cwd(), 'src/proto/mail/templates');

export default function MailTemplatesPage() {
  const templates = MAIL_TEMPLATES.map((t) => ({ ...t, html: readFileSync(join(DIR, `${t.key}.html`), 'utf8') }));

  return (
    <div className='mx-auto flex max-w-[100rem] flex-col gap-6 px-6 py-10'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-2xl font-extrabold tracking-tight'>메일 템플릿</h1>
        <p className='text-sm text-fg-muted'>
          시안 HTML 을 고치면 오른쪽에 바로 보인다. 고친 HTML 은 저장되지 않는다 — 「HTML 복사」로 시안 파일(
          <code className='font-mono text-xs'>playground/src/proto/mail/templates/</code>)에 붙여 PR 을 내고, 반영은{' '}
          <code className='font-mono text-xs'>V{'{n}'}</code> 마이그레이션이다.
        </p>
      </header>
      <MailEditor templates={templates} />
    </div>
  );
}
