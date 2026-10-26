import { toPreviewDocument } from '@/features/notification-templates/preview-document';

/** 저장 전 입력값을 표시한다. 치환 변수는 예시 값으로 바꾸지 않는다. */
export function TemplatePreview({ subject, body }: { subject: string; body: string }) {
  return (
    <div className='flex flex-col gap-3'>
      <div className='rounded-card border border-border bg-surface-1 px-4 py-3'>
        <span className='text-xs text-fg-muted'>메일 제목</span>
        <p className='break-words text-sm font-semibold text-ink'>
          {subject.trim() ? subject : '제목을 입력해 주세요.'}
        </p>
      </div>
      {body.trim() ? (
        <iframe
          title='메일 본문 미리보기'
          sandbox=''
          srcDoc={toPreviewDocument(body)}
          className='h-112 w-full rounded-card border border-border bg-bg'
        />
      ) : (
        <div className='flex min-h-64 items-center justify-center rounded-card border border-border bg-surface-1 p-6 text-center text-sm text-fg-muted'>
          본문을 입력하면 여기에 미리보기가 표시됩니다.
        </div>
      )}
    </div>
  );
}
