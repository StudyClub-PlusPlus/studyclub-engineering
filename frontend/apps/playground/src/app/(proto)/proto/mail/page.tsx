import { EmptyState } from '@studyclub/ui';

import { MailPreview } from '@/proto/mail/MailPreview';
import type { MailTemplate } from '@/proto/mail/render';

export const metadata = { title: '메일 템플릿' };

// 요청마다 DB 의 지금 문구를 읽는다 — 빌드 때 굳히면 문구를 고쳐도 화면이 옛것을 보여 준다
export const dynamic = 'force-dynamic';

type Loaded = { templates: MailTemplate[] } | { error: string };

/**
 * 서버에서 부른다. 공개 미리보기 API 라 토큰이 없고, 브라우저가 부르지 않으니 백엔드 CORS 를 넓히지 않아도 된다.
 * API_BASE_URL 은 런타임 env — 로컬은 .env, 도커는 docker-compose 가 넣는다.
 */
async function loadTemplates(): Promise<Loaded> {
  const base = process.env.API_BASE_URL;
  if (!base) return { error: 'API_BASE_URL 이 비어 있어 백엔드를 부를 수 없어요. .env 에 백엔드 주소를 넣고 다시 띄워 주세요.' };
  try {
    const res = await fetch(`${base}/api/notification-templates`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { error: `템플릿을 읽지 못했어요 (HTTP ${res.status}). 백엔드가 이 기능이 들어간 버전인지 확인해 주세요.` };
    return { templates: (await res.json()) as MailTemplate[] };
  } catch {
    return { error: `백엔드(${base})에 닿지 않아요. 백엔드가 떠 있는지 확인해 주세요.` };
  }
}

export default async function MailTemplatesPage() {
  const loaded = await loadTemplates();

  return (
    <div className='mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10'>
      <header className='flex flex-col gap-1'>
        <h1 className='text-2xl font-extrabold tracking-tight'>메일 템플릿</h1>
        <p className='text-sm text-fg-muted'>
          지금 DB 에 등록된 알림 메일 문구다. 예시 값을 바꿔 실제로 어떻게 나가는지 본다. 읽기 전용 — 고치는 길은 아직 없다.
        </p>
      </header>

      {'error' in loaded ? (
        <EmptyState title='템플릿을 불러오지 못했어요' description={loaded.error} />
      ) : loaded.templates.length === 0 ? (
        <EmptyState title='등록된 템플릿이 없어요' description='DB 의 NOTIFICATION_TEMPLATE 이 비어 있다.' />
      ) : (
        <MailPreview templates={loaded.templates} />
      )}
    </div>
  );
}
