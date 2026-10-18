'use client';

import { useEffect, useRef, useState } from 'react';

import { getUser } from '@core/lib/auth';
import { Button, Input, Modal, Textarea, Toaster, toast } from '@studyclub/ui';
import { ImagePlus, X } from 'lucide-react';

import {
  BODY_MAX,
  BODY_MIN,
  FEEDBACK_TYPES,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_COUNT,
  IMAGE_TYPES,
  TITLE_MAX,
  TITLE_MIN,
  addFeedback,
  type FeedbackType,
} from '@/proto/lib/feedback';

/**
 * 문의·오류 신고 — 사이트 어디서든 같은 팝업 하나를 연다.
 *
 * 여는 자리는 둘: 프로필 드롭다운(로그인)과 푸터(비로그인 포함). **플로팅 버튼은 만들지 않는다.**
 * 팝업은 레이아웃에 하나만 두고(`FeedbackHost`), 여는 쪽은 `openFeedback()` 만 부른다.
 *
 * 입력·설정 팝업 규칙(POL-0008) — X 와 보내기 하나, 취소 없음. 닫으면 입력은 사라지고 묻지 않는다.
 * 이미지 첨부는 선택 — 3장까지, 장당 5MB. 고르거나 끌어 놓거나 ⌘V 로 붙여 넣는다(스크린샷).
 * TODO(api): POST /api/feedbacks — 인증 선택, 서버가 rate limit(로그인 = 사용자, 비로그인 = IP)
 */

const OPEN_EVENT = 'sc:open-feedback';

export function openFeedback() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

type Draft = { type: FeedbackType | ''; title: string; body: string; images: string[] };
const EMPTY: Draft = { type: '', title: '', body: '', images: [] };

/**
 * 프로토는 브라우저에만 남기므로 긴 변을 1280px 로 줄여 JPEG 로 바꾼다 — 원본을 그대로 담으면 저장 공간이 넘친다.
 * TODO(api): 업로드 API 로 원본을 올리고 fileId 를 받는다 (STORAGE_OBJECT)
 */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

function Count({ len, min, max }: { len: number; min: number; max: number }) {
  const bad = len > 0 && (len < min || len > max);
  return <span className={`tnum ${bad ? 'text-warning-700' : 'text-fg-placeholder'}`}>{len}/{max}</span>;
}

export function FeedbackHost({ discordUrl }: { discordUrl: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => {
      setDraft(EMPTY);
      setTouched(false);
      setImageError(null);
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  const title = draft.title.trim();
  const body = draft.body.trim();
  const errors = {
    type: draft.type ? undefined : '유형을 선택해 주세요.',
    title:
      title.length < TITLE_MIN
        ? `제목을 ${TITLE_MIN}자 이상 입력해 주세요.`
        : title.length > TITLE_MAX
          ? `제목은 ${TITLE_MAX}자까지 쓸 수 있어요.`
          : undefined,
    body:
      body.length < BODY_MIN
        ? `내용을 ${BODY_MIN}자 이상 입력해 주세요.`
        : body.length > BODY_MAX
          ? `내용은 ${BODY_MAX}자까지 쓸 수 있어요.`
          : undefined,
  };
  const invalid = Boolean(errors.type || errors.title || errors.body);

  async function attach(files: File[]) {
    setImageError(null);
    const room = IMAGE_MAX_COUNT - draft.images.length;
    if (room <= 0) {
      setImageError(`이미지는 ${IMAGE_MAX_COUNT}장까지 붙일 수 있어요.`);
      return;
    }
    const ok: File[] = [];
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) {
        setImageError('PNG · JPG · WEBP · GIF 이미지만 붙일 수 있어요.');
        continue;
      }
      if (f.size > IMAGE_MAX_BYTES) {
        setImageError('이미지는 한 장에 5MB까지 붙일 수 있어요.');
        continue;
      }
      ok.push(f);
    }
    if (ok.length > room) setImageError(`이미지는 ${IMAGE_MAX_COUNT}장까지 붙일 수 있어요.`);
    try {
      const next = await Promise.all(ok.slice(0, room).map(shrink));
      setDraft((d) => ({ ...d, images: [...d.images, ...next].slice(0, IMAGE_MAX_COUNT) }));
    } catch {
      setImageError('이미지를 읽지 못했어요. 다른 파일로 시도해 주세요.');
    }
  }

  async function send() {
    setTouched(true);
    if (invalid || sending) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 600));
    try {
      // 자동 수집 — 사용자가 입력하지 않는다
      addFeedback({
        type: draft.type as FeedbackType,
        title,
        body: draft.body,
        images: draft.images.length > 0 ? draft.images : undefined,
        author: getUser()?.nickname ?? undefined,
        pageUrl: window.location.pathname.replace('/proto/core', '') + window.location.search,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}×${window.innerHeight}`,
      });
    } catch {
      setSending(false);
      // 실패 — 팝업을 닫지 않고 입력을 남긴다
      toast.error(
        (t) => (
          <span className='flex items-center gap-3'>
            의견을 보내지 못했습니다. 다시 시도해 주세요.
            <button
              type='button'
              className='shrink-0 font-semibold text-primary-600 underline-offset-2 hover:underline'
              onClick={() => {
                toast.dismiss(t.id);
                void send();
              }}
            >
              다시 시도
            </button>
          </span>
        ),
        { duration: 8000 },
      );
      return;
    }
    setSending(false);
    setOpen(false);
    // 답변을 약속하는 말은 쓰지 않는다
    toast.success('의견을 보내주셔서 감사합니다.');
  }

  return (
    <>
      <Toaster position='bottom-right' />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title='문의·오류 신고'
        size='lg'
        footer={
          <Button data-anno='feedback:5' onClick={send} loading={sending} disabled={sending}>
            보내기
          </Button>
        }
      >
        <div
          className='flex flex-col gap-4'
          onPaste={(e) => {
            // 클립보드에 이미지가 있으면 첨부로 받는다 — 글자 붙여넣기는 그대로 둔다
            const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
            if (files.length === 0) return;
            e.preventDefault();
            void attach(files);
          }}
        >
          <div data-anno='feedback:2' className='flex flex-col gap-1.5'>
            <span className='text-sm font-medium text-neutral-800'>
              유형<span className='ml-0.5 text-error-600'>*</span>
            </span>
            {/* 기본 선택이 없다 — 무엇을 보내는지는 보내는 사람이 고른다 */}
            <div role='radiogroup' aria-label='유형' className='flex flex-wrap gap-x-5 gap-y-2'>
              {FEEDBACK_TYPES.map((t) => (
                <label key={t.value} className='inline-flex cursor-pointer items-center gap-2 text-sm text-fg'>
                  <input
                    type='radio'
                    name='feedback-type'
                    value={t.value}
                    checked={draft.type === t.value}
                    onChange={() => setDraft({ ...draft, type: t.value })}
                    className='h-4 w-4 accent-(--color-brand)'
                  />
                  {t.label}
                </label>
              ))}
            </div>
            {touched && errors.type && <p className='text-xs text-error-700'>{errors.type}</p>}
          </div>

          <div data-anno='feedback:3'>
            <Input
              label='제목'
              required
              value={draft.title}
              maxLength={TITLE_MAX}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              error={touched ? errors.title : undefined}
              labelHint={<Count len={title.length} min={TITLE_MIN} max={TITLE_MAX} />}
            />
          </div>

          <div data-anno='feedback:4'>
            <Textarea
              label='내용'
              required
              rows={7}
              value={draft.body}
              maxLength={BODY_MAX}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              error={touched ? errors.body : undefined}
              labelHint={<Count len={body.length} min={BODY_MIN} max={BODY_MAX} />}
            />
            {draft.type === 'question' && (
              <p data-anno='feedback:4-1' className='mt-2 rounded-control bg-surface-2 px-3 py-2 text-sm text-fg-secondary'>
                문의는 디스코드 채널에서 더 빨리 답변받으실 수 있어요.{' '}
                <a
                  href={discordUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-semibold text-brand underline-offset-2 hover:underline'
                >
                  디스코드 채널 열기
                </a>
              </p>
            )}
          </div>

          {/* 이미지 첨부 — 선택. 오류는 스크린샷이 있으면 재현이 쉽다 */}
          <div data-anno='feedback:5-1' className='flex flex-col gap-1.5'>
            <span className='flex items-baseline justify-between text-sm font-medium text-neutral-800'>
              이미지 첨부
              <span className='tnum text-xs font-normal text-fg-placeholder'>
                {draft.images.length}/{IMAGE_MAX_COUNT}
              </span>
            </span>
            <div className='flex flex-wrap gap-2'>
              {draft.images.map((src, i) => (
                <div key={i} className='group relative h-20 w-20 overflow-hidden rounded-control border border-border'>
                  {/* eslint-disable-next-line @next/next/no-img-element -- 붙인 그 자리의 미리보기라 최적화가 필요 없다 */}
                  <img src={src} alt={`첨부 이미지 ${i + 1}`} className='h-full w-full object-cover' />
                  <button
                    type='button'
                    onClick={() => setDraft((d) => ({ ...d, images: d.images.filter((_, j) => j !== i) }))}
                    aria-label={`첨부 이미지 ${i + 1} 빼기`}
                    className='absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80'
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {draft.images.length < IMAGE_MAX_COUNT && (
                <button
                  type='button'
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void attach(Array.from(e.dataTransfer.files));
                  }}
                  className={`flex h-20 min-w-[13rem] flex-1 flex-col items-center justify-center gap-1 rounded-control border border-dashed text-xs transition-colors ${
                    dragging ? 'border-brand bg-brand/5 text-brand' : 'border-border-strong text-fg-muted hover:bg-surface-2'
                  }`}
                >
                  <ImagePlus size={18} />
                  <span>눌러서 고르거나 끌어 놓기 · ⌘V 붙여넣기</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type='file'
              accept={IMAGE_TYPES.join(',')}
              multiple
              hidden
              onChange={(e) => {
                void attach(Array.from(e.target.files ?? []));
                e.target.value = '';
              }}
            />
            <p className={`text-xs ${imageError ? 'text-error-700' : 'text-fg-muted'}`}>
              {imageError ?? `선택 · ${IMAGE_MAX_COUNT}장까지, 한 장에 5MB · PNG · JPG · WEBP · GIF`}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}

/** 여는 버튼 — 푸터 같은 서버 컴포넌트 안에서도 쓸 수 있게 따로 둔다 */
export function FeedbackLink({ label, className }: { label: string; className?: string }) {
  return (
    <button type='button' onClick={openFeedback} className={className}>
      {label}
    </button>
  );
}
