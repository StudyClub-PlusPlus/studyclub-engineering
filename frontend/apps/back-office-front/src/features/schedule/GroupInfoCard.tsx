'use client';

import { useEffect, useId, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, DiscordGlyph, Textarea, cx, IconButton, ButtonLink } from '@studyclub/ui';
import { ChevronDown, FolderOpen } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { groupRulesSchema, type GroupRulesValues } from '@/features/schedule/form-schemas';
import { RULES_MAX } from '@/features/schedule/meetings';

/** 정보 카드의 바로가기 — 아이콘과 이름만 보이고 새 창으로 연다. 주소는 가리키면 보인다. */
/**
 * 반 정보 카드 — 스터디 시간 · 네비게이터 · 디스코드 · 자료실과 스터디 규칙. 사용자 사이트 스터디 정보 카드와 같은 카드다.
 *
 * - 스터디 시간은 옆 「수정」으로 여기서 고친다. 네비게이터는 신청자 탭에서 정한다
 * - 캡틴은 참여 여부와 상관없이 두 바로가기가 늘 보인다. 주소가 비어 있으면 그 버튼을 두지 않는다
 * - 규칙은 반마다 하나. 늘 열린 글 상자로 바로 고치고, 저장한 글과 달라지면 「취소 · 저장」이 나온다
 */
export function GroupInfoCard({
  time,
  onEditTime,
  navigator,
  discordHref,
  driveHref,
  rules,
  onSaveRules,
  onDirtyChange,
}: {
  /** 「매주 수요일 20:30 KST」 */
  time: string;
  onEditTime: () => void;
  navigator: string;
  discordHref?: string;
  driveHref?: string;
  rules: string;
  onSaveRules: (text: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  /** 처음엔 펼친다. 접으면 머리 줄만 남는다. 접어도 저장하지 않은 규칙 글은 남는다. */
  const [expanded, setExpanded] = useState(true);
  const { watch, setValue, reset, handleSubmit } = useForm<GroupRulesValues>({
    resolver: zodResolver(groupRulesSchema),
    defaultValues: { rules },
  });
  const draft = watch('rules');
  const bodyId = useId();

  const dirty = draft.trim() !== rules.trim();
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const save = handleSubmit(({ rules }) => {
    onSaveRules(rules.trim());
    setValue('rules', rules.trim());
  });

  return (
    <section className='card mb-5 px-5 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <dl className='flex flex-wrap items-center gap-x-6 gap-y-1 type-body-sm'>
          <div className='flex items-center gap-2'>
            <dt className='text-fg-muted'>스터디 시간</dt>
            <dd className='tnum font-semibold text-fg'>{time}</dd>
            <dd>
              <Button type='button' variant='tertiary' size='sm' aria-label='스터디 시간 수정' onClick={onEditTime}>
                수정
              </Button>
            </dd>
          </div>
          <div className='flex items-center gap-2'>
            <dt className='text-fg-muted'>네비게이터</dt>
            <dd className='font-semibold text-fg'>{navigator}</dd>
          </div>
        </dl>
        <div className='flex flex-wrap gap-1.5'>
          {discordHref && (
            <ButtonLink
              href={discordHref}
              external
              variant='secondary'
              size='sm'
              title={discordHref}
              leadingIcon={<DiscordGlyph />}
            >
              디스코드
            </ButtonLink>
          )}
          {driveHref && (
            <ButtonLink
              href={driveHref}
              external
              variant='secondary'
              size='sm'
              title={driveHref}
              leadingIcon={<FolderOpen strokeWidth={1.75} aria-hidden />}
            >
              자료실
            </ButtonLink>
          )}
          <IconButton
            variant='tertiary'
            size='sm'
            aria-expanded={expanded}
            aria-controls={bodyId}
            aria-label='스터디 규칙'
            title={expanded ? '접기' : '펼치기'}
            onClick={() => setExpanded((v) => !v)}
            icon={<ChevronDown className={cx('transition-transform', expanded && 'rotate-180')} />}
          />
        </div>
      </div>

      {/* 접어도 본문을 지우지 않고 숨긴다 — aria-controls 가 가리킬 곳이 늘 있고, 저장하지 않은 글도 남는다 */}
      <div id={bodyId} hidden={!expanded} className='mt-3 border-t border-border pt-3'>
        <h3 className='type-title-md text-fg'>스터디 규칙</h3>
        <div className='mt-2 flex flex-col gap-2'>
          <Textarea
            aria-label='스터디 규칙'
            value={draft}
            placeholder='아직 규칙이 없습니다'
            maxLength={RULES_MAX}
            rows={4}
            showCount
            className='bg-surface-1 leading-relaxed'
            onChange={(e) => setValue('rules', e.target.value, { shouldDirty: true })}
          />
          {dirty && (
            <div className='flex justify-end gap-2'>
              <Button variant='secondary' size='sm' onClick={() => reset({ rules })}>
                취소
              </Button>
              <Button size='sm' onClick={save}>
                저장
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
