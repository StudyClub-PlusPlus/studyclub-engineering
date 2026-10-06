'use client';

import { useEffect, useState } from 'react';

import { AutoTextarea } from '@core/components/AutoTextarea';
import { RULES_MAX, getRules, saveRules } from '@core/lib/schedule-board';
import { Button, cx } from '@studyclub/ui';

/**
 * 스터디 규칙 (STUDY_GROUP.RULES) — 분반마다 하나.
 *
 * 사용자 사이트 스터디 정보 카드와 백오피스 일정 탭이 같은 것을 쓴다.
 * 캡틴·네비게이터는 늘 열린 글 상자로 바로 고치고, 크루는 글로 본다(길면 4줄로 접는다).
 *
 * `storeKey` 는 분반의 저장 키다. 백오피스의 처음 반은 사용자 사이트 그 분반과 같은 키를 써서 같은 규칙을 본다.
 */
export function RulesEditor({
  storeKey,
  canEdit,
  onDirtyChange,
}: {
  storeKey: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [rules, setRules] = useState('');
  /** 고치는 중인 글. 저장한 글과 다르면 저장·취소가 나온다. */
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = getRules(storeKey);
    setRules(saved);
    setDraft(saved);
  }, [storeKey]);

  const long = rules.split('\n').length > 4 || rules.length > 240;
  const changed = draft.trim() !== rules.trim();

  const dirty = canEdit && changed;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // 저장하지 않은 규칙 글이 있으면 새로고침·창 닫기 때 브라우저가 묻는다.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function save() {
    // TODO(api): PUT /api/studies/{studyId}/groups/{groupId}/rules
    saveRules(storeKey, draft.trim());
    setRules(draft.trim());
    setDraft(draft.trim());
  }

  return (
    <>
      <h3 className='text-sm font-bold text-fg'>스터디 규칙</h3>
      {canEdit ? (
        <div className='mt-2 flex flex-col gap-2'>
          <AutoTextarea
            label='스터디 규칙'
            value={draft}
            placeholder='킥오프에서 정한 규칙을 적어 두세요. 발표 방식 · 지각 기준 · 소요 시간 등'
            maxLength={RULES_MAX}
            minRows={4}
            className='px-3 py-2 leading-relaxed'
            onChange={setDraft}
          />
          <div className='flex items-center justify-between gap-2'>
            <span className='tnum text-xs text-fg-muted'>
              {draft.length}/{RULES_MAX}
            </span>
            {changed && (
              <span className='flex gap-2'>
                <Button variant='secondary' size='sm' onClick={() => setDraft(rules)}>
                  취소
                </Button>
                <Button size='sm' onClick={save}>
                  저장
                </Button>
              </span>
            )}
          </div>
        </div>
      ) : rules ? (
        <>
          <p
            className={cx(
              'mt-1.5 whitespace-pre-line text-sm leading-relaxed text-fg-secondary',
              long && !open && 'line-clamp-4',
            )}
          >
            {rules}
          </p>
          {long && (
            <button
              type='button'
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className='mt-1 text-xs font-semibold text-brand underline-offset-2 hover:underline'
            >
              {open ? '접기' : '모두 보기'}
            </button>
          )}
        </>
      ) : (
        <p className='mt-1.5 text-sm text-fg-muted'>아직 규칙이 없습니다.</p>
      )}
    </>
  );
}
