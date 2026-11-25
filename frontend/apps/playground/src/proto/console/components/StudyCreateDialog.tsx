'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import {
  EMPTY_FORM,
  StudyForm,
  studyToForm,
  validateStudyForm,
  type StudyFormErrors,
  type StudyFormValues,
} from '@console/components/StudyForm';
import type { Study } from '@studyclub/types';
import { Button, Modal } from '@studyclub/ui';

import { saveReusedDraft } from '../lib/reused-drafts';
import { ScreenSpecRegistrar } from '@/proto/annotate';
import { saveRecruitmentZones } from '@/proto/lib/recruitment-zone-store';
import { STUDY_CREATE_SPEC as SPEC } from '@/proto/specs/study-create';

/**
 * 스터디 등록 팝업 — 프로토타입.
 *
 * 폼 본체는 `StudyForm` 이며 **정보 탭이 같은 것을 쓴다.** 등록과 수정에서 보이는 칸이 달라지면
 * 운영자가 화면마다 다른 것을 외워야 한다.
 *
 * 클럽의 다음 기수는 여기서 만들지 않는다 — 클럽 운영 › 기수의 「다음 기수」가 만든다 (POL-0012).
 * 기간 · 제목을 자유롭게 적으면 「기수는 달 하나 · 같은 달 기수는 하나」가 깨진다.
 *
 * 저장 대상 테이블이 아직 없으므로(백엔드 도메인 미착수) **제출은 화면 상태로만** 처리한다.
 */
export function StudyCreateDialog({
  open,
  onClose,
  /** 지정하면 편집 모드. 없으면 등록 모드. */
  study,
  reuseOf,
}: {
  open: boolean;
  onClose: () => void;
  study?: Study;
  reuseOf?: Study;
}) {
  const editing = Boolean(study);
  const [form, setForm] = useState<StudyFormValues>(EMPTY_FORM);
  const dirty = useRef(false);
  const [errors, setErrors] = useState<StudyFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open || dirty.current) return;
    setSaveError('');
    if (reuseOf) {
      const { title, summary, description, category } = studyToForm(reuseOf);
      setForm({ ...EMPTY_FORM, title, summary, description, category });
    } else setForm(study ? studyToForm(study) : EMPTY_FORM);
    setErrors({});
    setDone(false);
  }, [open, study, reuseOf]);

  function close() {
    dirty.current = false;
    setForm(EMPTY_FORM);
    setErrors({});
    setDone(false);
    onClose();
  }

  async function handleSubmit() {
    const e = validateStudyForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    if (saving) return;
    setSaving(true);
    setSaveError('');
    if (reuseOf) {
      try {
        saveReusedDraft(form);
        setDone(true);
      } catch {
        setSaveError('저장하지 못했어요. 입력한 내용을 확인하고 다시 시도해 주세요.');
      } finally {
        setSaving(false);
      }
      return;
    }
    // TODO(api): POST /api/studies — 저장 대상 테이블이 없어 화면 상태로만 처리
    await new Promise((r) => setTimeout(r, 400));
    if (study) saveRecruitmentZones(study.id, form.recruitmentTimeZones);
    setSaving(false);
    setDone(true);
  }

  return (
    <>
      {open && !editing ? <ScreenSpecRegistrar spec={SPEC} /> : null}
      <Modal
        open={open}
        onClose={close}
        title={
          reuseOf ? '이 내용으로 새 스터디' : editing ? '스터디 편집' : '스터디 등록'
        }
        size='lg'
        footer={
          done ? (
            reuseOf ? (
              <Link href={`/proto/console/studies?status=DRAFT&q=${encodeURIComponent(form.title)}`}>
                스터디 목록에서 확인
              </Link>
            ) : (
              <Button onClick={close}>확인</Button>
            )
          ) : (
            /* 입력·설정 모달이라 취소를 두지 않는다 — 닫는 길은 X 와 Esc 다 (POL-0008) */
            <>
              {reuseOf && (
                <Button variant='secondary' onClick={close}>
                  취소
                </Button>
              )}
              <Button data-anno='9' onClick={handleSubmit} loading={saving}>
                {reuseOf ? '미공개로 등록' : editing ? '저장' : '등록'}
              </Button>
            </>
          )
        }
      >
        {done ? (
          <p className='py-6 text-center type-body-sm text-fg-muted'>
            {editing ? '저장되었습니다.' : '등록되었습니다. 아직 사이트에 보이지 않습니다 — 목록에서 공개를 켜세요.'}
          </p>
        ) : (
          <>
            {saveError && <p role='alert'>{saveError}</p>}
            <StudyForm
              mode={reuseOf ? 'reuse' : editing ? 'edit' : 'create'}
              value={form}
              errors={errors}
              onChange={(next) => { dirty.current = true; setForm(next); }}
            />
          </>
        )}
      </Modal>
    </>
  );
}
