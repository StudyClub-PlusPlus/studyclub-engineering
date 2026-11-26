'use client';

import { useEffect, useRef, useState } from 'react';

import {
  StudyForm,
  studyToForm,
  validateStudyForm,
  type StudyFormErrors,
  type StudyFormValues,
} from '@console/components/StudyForm';
import { useDisplayTimeZone, useTimeZoneChangeLock } from '@core/lib/use-display-timezone';
import type { Study } from '@studyclub/types';
import { Button, Modal } from '@studyclub/ui';

import { saveRecruitmentZones } from '@/proto/lib/recruitment-zone-store';

/**
 * 정보 탭.
 *
 * **등록 팝업과 같은 폼을 그대로 편다.** 읽기 화면을 따로 두고 "수정" 버튼으로 팝업을 띄우면,
 * 운영자는 같은 정보를 두 가지 모양으로 보게 되고 어디를 눌러야 뭐가 바뀌는지 매번 확인해야 한다.
 * 여기서는 보이는 칸이 곧 고치는 칸이다.
 *
 * TODO(api): PATCH /api/studies/{id} · DELETE /api/studies/{id}
 */
export function StudyInfoTab({ study }: { study: Study }) {
  const zone = useDisplayTimeZone();
  const [form, setForm] = useState<StudyFormValues>(() => studyToForm(study, zone));
  const loadedStudyId = useRef(study.id);
  const dirty = useRef(false);
  useTimeZoneChangeLock(dirty.current);
  const [errors, setErrors] = useState<StudyFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (loadedStudyId.current !== study.id) {
      loadedStudyId.current = study.id;
      dirty.current = false;
      setForm(studyToForm(study, zone));
      setErrors({});
      setSaved(false);
    } else if (!dirty.current) {
      // 모집 시간대 저장 알림으로 제목·설명 등 다른 입력값을 초기화하지 않는다.
      setForm((current) => ({ ...current, recruitmentTimeZones: studyToForm(study, zone).recruitmentTimeZones, deadline: studyToForm(study, zone).deadline }));
    }
  }, [study, zone]);

  function change(next: StudyFormValues) {
    dirty.current = true;
    setForm(next);
    setSaved(false);
  }

  async function save() {
    const e = validateStudyForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    // TODO(api): PATCH /api/studies/{id}
    await new Promise((r) => setTimeout(r, 400));
    dirty.current = false;
    saveRecruitmentZones(study.id, form.recruitmentTimeZones);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className='card px-6 py-5'>
      <div data-anno='edit:1'>
        <StudyForm mode='edit' value={form} errors={errors} onChange={change} />
      </div>

      <div className='mt-6 flex items-center gap-3 border-t border-border pt-4'>
        {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 되돌릴 수 없다 */}
        <Button type='button' variant='danger' data-anno='edit:3' onClick={() => setConfirmDelete(true)} disabled={saving}>
          스터디 삭제
        </Button>
        <div className='ml-auto flex items-center gap-3'>
          {saved && <span className='type-label-lg text-success-700'>저장되었습니다.</span>}
          <span data-anno='edit:2'>
            <Button onClick={save} loading={saving}>
              저장
            </Button>
          </span>
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title='스터디 삭제'
        footer={
          <>
            {/* 결정을 묻는 모달 — 안전한 쪽이 기본 포커스를 받는다. Enter 로 삭제되면 안 된다 (POL-0008) */}
            <Button variant='secondary' data-autofocus onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
            <Button variant='destructive' onClick={() => setConfirmDelete(false)}>
              삭제
            </Button>
          </>
        }
      >
        <div className='py-6 text-center'>
          <p className='type-label-lg text-fg'>‘{form.title}’ 스터디를 삭제합니다.</p>
          <p className='mt-1.5 type-body-sm text-fg-muted'>크루 명단과 출석 기록도 함께 사라지며 되돌릴 수 없습니다.</p>
        </div>
      </Modal>
    </div>
  );
}
