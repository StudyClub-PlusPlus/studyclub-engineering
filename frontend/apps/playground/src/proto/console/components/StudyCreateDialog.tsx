'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  EMPTY_FORM,
  StudyForm,
  cohortDefaults,
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
 * 새 기수 폼 — 제목은 프로그램 제목, 소개·설명·카테고리는 최신 기수.
 * 마감일·일정·정원·진행 시작일은 기수마다 다르니 비운다.
 *
 * **채널·드라이브 주소는 비우지 않는다** — 클럽은 기수가 바뀌어도 같은 채널을 계속 쓴다. 새 채널을 팠다면
 * `cohortDefaults` 가 물려준 값을 폼에서 직접 고치면 된다.
 */
function nextCohortForm(from: Study): StudyFormValues {
  return {
    ...EMPTY_FORM,
    ...studyToForm(from),
    ...cohortDefaults(from.program?.id ?? ''),
    deadline: '',
    capacity: '',
    unlimited: true,
    schedule: '',
    startAt: '',
  };
}

/**
 * 스터디 등록 팝업 — 프로토타입.
 *
 * 폼 본체는 `StudyForm` 이며 **정보 탭이 같은 것을 쓴다.** 등록과 수정에서 보이는 칸이 달라지면
 * 운영자가 화면마다 다른 것을 외워야 한다.
 *
 * **다음 기수 만들기**(`nextOf`)도 이 팝업이 한다 — 제목은 프로그램 제목, 소개·설명·카테고리는 최신 기수의 것으로
 * 채우고 프로그램은 고정한다. 날짜(마감·일정)와 정원은 기수마다 달라 비워 둔다.
 *
 * 저장 대상 테이블이 아직 없으므로(백엔드 도메인 미착수) **제출은 화면 상태로만** 처리한다.
 */
export function StudyCreateDialog({
  open,
  onClose,
  /** 지정하면 편집 모드. 없으면 등록 모드. */
  study,
  /** 지정하면 그 스터디의 프로그램에 붙는 새 기수를 만든다. 직전 기수의 설정을 복사해 시작한다. */
  nextOf,
  reuseOf,
}: {
  open: boolean;
  onClose: () => void;
  study?: Study;
  nextOf?: Study;
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
    } else setForm(study ? studyToForm(study) : nextOf ? nextCohortForm(nextOf) : EMPTY_FORM);
    setErrors({});
  }, [open, study, nextOf, reuseOf]);

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
        title={reuseOf ? '스터디 복제' : editing ? '스터디 편집' : nextOf ? '다음 기수 만들기' : '스터디 등록'}
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
          mode={nextOf ? 'edit' : 'create'}
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
