"use client";

import { useEffect, useState } from "react";
import { Button, Modal } from "@studyclub/ui";
import {
  EMPTY_FORM,
  StudyForm,
  studyToForm,
  validateStudyForm,
  type StudyFormErrors,
  type StudyFormValues,
} from "@/components/StudyForm";
import type { Study } from "@studyclub/mock";

/**
 * 스터디 등록 팝업 — 프로토타입.
 *
 * 폼 본체는 `StudyForm` 이며 **정보 탭이 같은 것을 쓴다.** 등록과 수정에서 보이는 칸이 달라지면
 * 운영자가 화면마다 다른 것을 외워야 한다.
 *
 * 저장 대상 테이블이 아직 없으므로(백엔드 도메인 미착수) **제출은 화면 상태로만** 처리한다.
 */
export function StudyCreateDialog({
  open,
  onClose,
  /** 지정하면 편집 모드. 없으면 등록 모드. */
  study,
}: {
  open: boolean;
  onClose: () => void;
  study?: Study;
}) {
  const editing = Boolean(study);
  const [form, setForm] = useState<StudyFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<StudyFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(study ? studyToForm(study) : EMPTY_FORM);
    setErrors({});
    setDone(false);
  }, [open, study]);

  function close() {
    setForm(EMPTY_FORM);
    setErrors({});
    setDone(false);
    onClose();
  }

  async function handleSubmit() {
    const e = validateStudyForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    // TODO(api): POST /api/studies — 저장 대상 테이블이 없어 화면 상태로만 처리
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setDone(true);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? "스터디 편집" : "스터디 등록"}
      size="lg"
      footer={
        done ? (
          <Button onClick={close}>확인</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={saving}>
              취소
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? "저장" : "등록"}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <p className="py-6 text-center text-sm text-fg-muted">
          {editing
            ? "저장되었습니다."
            : form.publishAt
              ? `등록되었습니다. ${form.publishAt}부터 사이트에 공개됩니다.`
              : "등록되었습니다. 사이트에 바로 공개됩니다."}
        </p>
      ) : (
        <StudyForm value={form} errors={errors} onChange={setForm} />
      )}
    </Modal>
  );
}
