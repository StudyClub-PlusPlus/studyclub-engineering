'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  EMPTY_FORM,
  StudyForm,
  copyStudyForm,
  studyToForm,
  validateStudyForm,
  type StudyFormErrors,
  type StudyFormValues,
} from '@console/components/StudyForm';
import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import { studies } from '@studyclub/mock';
import type { Study } from '@studyclub/types';
import { Button, Modal, toast } from '@studyclub/ui';

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
  const router = useRouter();
  const zone = useDisplayTimeZone();

  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open || dirty.current) return;
    setSaveError('');
    if (reuseOf) {
      setForm(copyStudyForm(reuseOf));
    } else setForm(study ? studyToForm(study) : EMPTY_FORM);
    setErrors({});
  }, [open, study, reuseOf]);

  function close() {
    dirty.current = false;
    setForm(EMPTY_FORM);
    setErrors({});
    onClose();
  }

  async function handleSubmit() {
    const e = validateStudyForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      // TODO(api): POST /api/admin/studies → Location의 새 ID로 이동한다.
      const source = studies.find((candidate) => candidate.id === form.sourceId);
      const draft = !editing ? await saveReusedDraft(form, source, zone) : undefined;
      if (study) saveRecruitmentZones(study.id, form.recruitmentTimeZones);
      close();
      toast.success(editing ? '저장되었습니다' : '미공개로 등록되었습니다');
      if (draft) router.push(`/proto/console/studies/${draft.study_id}`);
    } catch (error) {
      if (error instanceof RangeError) {
        setErrors({ deadline: error.message });
        return;
      }
      setSaveError('저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {open && !editing ? <ScreenSpecRegistrar spec={SPEC} /> : null}
      <Modal
        open={open}
        onClose={close}
        title={reuseOf ? '스터디 복제' : editing ? '스터디 편집' : '스터디 등록'}
        size='lg'
        footer={
          <>
            <Button data-anno='9 reuse:3' onClick={handleSubmit} loading={saving}>
              {editing ? '저장' : '미공개로 등록'}
            </Button>
          </>
        }
      >
        {saveError && <p role='alert'>{saveError}</p>}
        <StudyForm
          mode={editing ? 'edit' : 'create'}
          value={form}
          errors={errors}
          onChange={(next) => {
            dirty.current = true;
            setForm(next);
          }}
        />
      </Modal>
    </>
  );
}
