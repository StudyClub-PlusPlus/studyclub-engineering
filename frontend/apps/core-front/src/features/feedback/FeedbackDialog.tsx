'use client';

import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Modal, Textarea, toast } from '@studyclub/ui';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';

import {
  CONTENT_MAX,
  CONTENT_MIN,
  EMPTY_FEEDBACK,
  FEEDBACK_TYPES,
  IMAGE_ACCEPT,
  IMAGE_COUNT_ERROR,
  IMAGE_HINT,
  IMAGE_MAX_COUNT,
  SENT_MESSAGE,
  TITLE_MAX,
  TITLE_MIN,
  TOO_MANY_MESSAGE,
  feedbackSchema,
  imageProblem,
  sendErrorMessage,
  toSubmitBody,
  uploadErrorMessage,
  viewportOf,
  type FeedbackFormInput,
  type FeedbackFormValues,
} from './feedback';
import { uploadFeedbackImage, useSubmitFeedback, type MyFeedbackItem } from './queries';

/**
 * 문의·오류 신고 작성 팝업 — 「내 문의」 목록의 [문의하기] 와 푸터 「문의·오류 신고」(`?write=1`)가 연다.
 * 프로토 proto/core/components/Feedback.tsx 를 옮겼다.
 *
 * - 입력·설정 팝업 규칙(POL-0008): X 와 [전송] 하나, 취소 없음. 닫으면 입력은 사라지고 묻지 않는다
 * - 자동으로 함께 가는 것은 화면 크기뿐. 브라우저·OS 는 서버가 요청 헤더에서 읽는다. 화면 경로는 모으지 않는다
 * - 이미지 첨부는 선택. 3장까지, 장당 5MB, PNG · JPG · WEBP. 고르거나 끌어 놓거나 붙여 넣으면 바로 올린다
 * - 전송하면 닫히고, 서버가 돌려준 건이 목록 맨 위에 선다 (부모의 `onSent`)
 */

const ERROR_TOAST_ID = 'feedback-send-error';

/**
 * 붙여넣기 단축키 — 맥만 ⌘V 다. 서버에서는 기기를 알 수 없으므로 Ctrl+V 로 그려 두고
 * 그려진 뒤에 맥이면 바꾼다 (프로토와 같다).
 */
function usePasteKey(): string {
  const [key, setKey] = useState('Ctrl+V');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setKey('⌘V');
  }, []);
  return key;
}

function Count({ len, min, max }: { len: number; min: number; max: number }) {
  const bad = len > 0 && (len < min || len > max);
  return (
    <span className={`tnum ${bad ? 'text-warning-700' : 'text-fg-placeholder'}`}>
      {len}/{max}
    </span>
  );
}

type Attachment = {
  key: number;
  /** 고른 파일의 미리보기 (object URL) — 올리는 동안에도 바로 보인다 */
  preview: string;
  /** 올리기가 끝나면 받은 번호. 없으면 올리는 중 */
  fileId?: number;
};

export type FeedbackDialogProps = {
  open: boolean;
  accountId: number;
  onClose: () => void;
  /** 201 — 서버가 돌려준 목록 한 줄 */
  onSent: (created: MyFeedbackItem) => void;
};

export function FeedbackDialog({ open, ...rest }: FeedbackDialogProps) {
  // 닫으면 입력은 사라진다 — 열 때마다 새로 그려 빈 칸에서 시작한다
  if (!open) return null;
  return <FeedbackDialogBody {...rest} />;
}

function FeedbackDialogBody({ accountId, onClose, onSent }: Omit<FeedbackDialogProps, 'open'>) {
  const pasteKey = usePasteKey();
  const submit = useSubmitFeedback(accountId);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FeedbackFormInput, unknown, FeedbackFormValues>({
    defaultValues: EMPTY_FEEDBACK,
    resolver: zodResolver(feedbackSchema),
    // 처음 [전송] 전에는 사유를 띄우지 않고, 그 뒤로는 고칠 때마다 다시 본다
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nextKey = useRef(0);
  // 올리는 도중 붙여넣기·끌어 놓기가 겹쳐도 3장을 넘지 않게 — 렌더를 기다리지 않는 현재 장수
  const countRef = useRef(0);
  const previews = useRef(new Set<string>());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const urls = previews.current;
    return () => {
      alive.current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      toast.dismiss(ERROR_TOAST_ID);
    };
  }, []);

  const titleLen = watch('title').trim().length;
  const contentLen = watch('content').trim().length;
  const uploading = attachments.some((a) => a.fileId === undefined);
  const sending = submit.isPending;

  function drop(key: number) {
    setAttachments((list) => {
      const target = list.find((a) => a.key === key);
      if (target) {
        URL.revokeObjectURL(target.preview);
        previews.current.delete(target.preview);
      }
      return list.filter((a) => a.key !== key);
    });
    countRef.current = Math.max(0, countRef.current - 1);
  }

  async function upload(file: File) {
    const key = nextKey.current++;
    const preview = URL.createObjectURL(file);
    previews.current.add(preview);
    setAttachments((list) => [...list, { key, preview }]);
    try {
      const { fileId } = await uploadFeedbackImage(file);
      if (!alive.current) return;
      setAttachments((list) => list.map((a) => (a.key === key ? { ...a, fileId } : a)));
    } catch (err) {
      if (!alive.current) return;
      drop(key);
      setImageError(uploadErrorMessage(err));
    }
  }

  function attach(files: File[]) {
    setImageError(null);
    const room = IMAGE_MAX_COUNT - countRef.current;
    if (room <= 0) {
      setImageError(IMAGE_COUNT_ERROR);
      return;
    }
    const ok: File[] = [];
    for (const file of files) {
      const problem = imageProblem(file);
      if (problem) {
        setImageError(problem);
        continue;
      }
      ok.push(file);
    }
    if (ok.length > room) setImageError(IMAGE_COUNT_ERROR);
    const accepted = ok.slice(0, room);
    countRef.current += accepted.length;
    accepted.forEach((file) => void upload(file));
  }

  const send = handleSubmit(async (values) => {
    if (sending || uploading) return;
    toast.dismiss(ERROR_TOAST_ID);
    const fileIds = attachments.flatMap((a) => (a.fileId === undefined ? [] : [a.fileId]));
    try {
      const created = await submit.mutateAsync(toSubmitBody(values, fileIds, viewportOf(window)));
      toast.success(SENT_MESSAGE);
      onSent(created);
      onClose();
    } catch (err) {
      // 실패 — 팝업을 닫지 않고 입력을 남긴다
      const message = sendErrorMessage(err);
      toast.error(
        message === TOO_MANY_MESSAGE ? (
          message
        ) : (
          <span className='flex items-center gap-3'>
            {message}
            <button
              type='button'
              className='shrink-0 font-semibold text-primary-600 underline-offset-2 hover:underline'
              onClick={() => {
                toast.dismiss(ERROR_TOAST_ID);
                void send();
              }}
            >
              다시 시도
            </button>
          </span>
        ),
        { id: ERROR_TOAST_ID, duration: 8000 },
      );
    }
  });

  return (
    <Modal
      open
      onClose={onClose}
      title='문의·오류 신고'
      size='lg'
      footer={
        <Button onClick={() => void send()} loading={sending || uploading} disabled={sending || uploading}>
          전송
        </Button>
      }
    >
      <div
        className='flex flex-col gap-4'
        onPaste={(e) => {
          // 클립보드에 이미지가 있으면 첨부로 받는다. 글자 붙여넣기는 그대로 둔다
          const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
          if (files.length === 0) return;
          e.preventDefault();
          attach(files);
        }}
      >
        <div className='flex flex-col gap-1.5'>
          <span id='feedback-type-label' className='text-sm font-medium text-neutral-800'>
            유형<span className='ml-0.5 text-error-600'>*</span>
          </span>
          {/* 기본 선택이 없다. 무엇을 보내는지는 보내는 사람이 고른다 */}
          <div
            role='radiogroup'
            aria-labelledby='feedback-type-label'
            aria-invalid={errors.type ? true : undefined}
            className='flex flex-wrap gap-x-5 gap-y-2'
          >
            {FEEDBACK_TYPES.map((t) => (
              <label key={t.value} className='inline-flex cursor-pointer items-center gap-2 text-sm text-fg'>
                <input type='radio' value={t.value} {...register('type')} className='h-4 w-4 accent-(--color-brand)' />
                {t.label}
              </label>
            ))}
          </div>
          {errors.type?.message && <p className='text-xs text-error-700'>{errors.type.message}</p>}
        </div>

        <Input
          label='제목'
          required
          maxLength={TITLE_MAX}
          {...register('title')}
          error={errors.title?.message}
          labelHint={<Count len={titleLen} min={TITLE_MIN} max={TITLE_MAX} />}
        />

        <Textarea
          label='내용'
          required
          rows={7}
          maxLength={CONTENT_MAX}
          {...register('content')}
          error={errors.content?.message}
          labelHint={<Count len={contentLen} min={CONTENT_MIN} max={CONTENT_MAX} />}
        />

        {/* 이미지 첨부 — 선택. 오류는 스크린샷이 있으면 재현이 쉽다 */}
        <div className='flex flex-col gap-1.5'>
          <span className='flex items-baseline justify-between text-sm font-medium text-neutral-800'>
            {/* 라벨과 (선택)을 한 덩어리로 묶는다. 따로 두면 양끝 정렬이 둘 사이를 벌려 놓는다 */}
            <span>
              이미지 첨부 <span className='font-normal text-fg-muted'>(선택)</span>
            </span>
            <span className='tnum text-xs font-normal text-fg-placeholder'>
              {attachments.length}/{IMAGE_MAX_COUNT}
            </span>
          </span>
          <div className='flex flex-wrap gap-2'>
            {attachments.map((a, i) => (
              <div key={a.key} className='relative h-20 w-20 overflow-hidden rounded-control border border-border'>
                {/* eslint-disable-next-line @next/next/no-img-element -- 고른 파일의 그 자리 미리보기라 최적화가 필요 없다 */}
                <img src={a.preview} alt={`첨부 이미지 ${i + 1}`} className='h-full w-full object-cover' />
                {a.fileId === undefined && (
                  <span
                    className='absolute inset-0 grid place-items-center bg-black/40 text-white'
                    aria-label='올리는 중'
                  >
                    <Loader2 size={18} className='animate-spin' />
                  </span>
                )}
                <button
                  type='button'
                  onClick={() => drop(a.key)}
                  aria-label={`첨부 이미지 ${i + 1} 빼기`}
                  className='absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80'
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {attachments.length < IMAGE_MAX_COUNT && (
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
                  attach(Array.from(e.dataTransfer.files));
                }}
                className={`flex h-20 min-w-[13rem] flex-1 flex-col items-center justify-center gap-1 rounded-control border border-dashed text-xs transition-colors ${
                  dragging
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-border-strong text-fg-muted hover:bg-surface-2'
                }`}
              >
                <ImagePlus size={18} />
                <span>클릭하거나 드래그하여 첨부 · {pasteKey}로 붙여넣기</span>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type='file'
            accept={IMAGE_ACCEPT}
            multiple
            hidden
            data-testid='feedback-image-input'
            onChange={(e) => {
              attach(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <p
            className={`text-xs ${imageError ? 'text-error-700' : 'text-fg-muted'}`}
            role={imageError ? 'alert' : undefined}
          >
            {imageError ?? IMAGE_HINT}
          </p>
        </div>
      </div>
    </Modal>
  );
}
