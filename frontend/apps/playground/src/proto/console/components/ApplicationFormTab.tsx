'use client';

import { useEffect, useState } from 'react';

import { tx } from '@console/lib/l10n';
import {
  allowsOther,
  formCardClass,
  FormHeaderCard,
  needsOptions,
  OptionEditor,
  QUESTION_TYPES,
  QuestionFillView,
  seedOptions,
  TYPE_LABEL,
} from '@core/components/ApplicationFormUi';
import { DiscordNicknameField, DISCORD_NICKNAME_LABEL } from '@core/components/DiscordNicknameField';
import { getUser } from '@core/lib/auth';
import { DISCORD_NICKNAME_EXAMPLE, getDiscordNickname, getDisplayName } from '@core/lib/me';
import { PREVIEW_USER } from '@core/lib/preview';
import type { ApplicationQuestion, ApplicationQuestionType, Study } from '@studyclub/mock';
import { Button, Checkbox, Input, Select } from '@studyclub/ui';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

/**
 * 신청 폼 탭 — 캡틴이 이 스터디의 신청서 질문을 직접 설계한다.
 *
 * 구글 폼처럼 **편집 카드가 작성 화면과 같은 모양**이다. 따로 미리보기를 두지 않는다.
 *
 * TODO(api): 저장 대상 컬럼(STUDY_COHORT.APPLICATION_FORM)이 아직 없어 화면 상태로만 처리.
 */

const DISCORD_QUESTION: ApplicationQuestion = {
  id: 'discord',
  label: DISCORD_NICKNAME_LABEL,
  type: 'text',
  required: true,
  placeholder: DISCORD_NICKNAME_EXAMPLE,
};

function newQuestion(): ApplicationQuestion {
  return { id: `q${Date.now()}`, label: '', type: 'text', required: true };
}

function extrasOf(study: Study): ApplicationQuestion[] {
  return (study.applicationForm ?? []).filter((q) => q.id !== DISCORD_QUESTION.id);
}

function readApplicantAccount() {
  const user = getUser() ?? PREVIEW_USER;
  return {
    name: getDisplayName() ?? user.name ?? user.email,
    email: user.email,
    discordNickname: getDiscordNickname(),
  };
}

export function ApplicationFormTab({ study }: { study: Study }) {
  const [questions, setQuestions] = useState<ApplicationQuestion[]>(() => extrasOf(study));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [focusOption, setFocusOption] = useState<{ id: string; index: number } | null>(null);
  const [account, setAccount] = useState(() => ({
    name: PREVIEW_USER.name ?? '홍길동',
    email: PREVIEW_USER.email,
    discordNickname: undefined as string | undefined,
  }));

  useEffect(() => {
    const live = readApplicantAccount();
    setAccount({
      name: PREVIEW_USER.name ?? live.name,
      email: PREVIEW_USER.email,
      discordNickname: live.discordNickname,
    });
  }, []);

  function update(id: string, patch: Partial<ApplicationQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    setSaved(false);
  }

  function remove(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
    if (selectedId === id) setSelectedId(null);
    setSaved(false);
  }

  function add() {
    const q = newQuestion();
    setQuestions((qs) => [...qs, q]);
    setSelectedId(q.id);
    setSaved(false);
  }

  function move(id: string, dir: -1 | 1) {
    setQuestions((qs) => {
      const i = qs.findIndex((q) => q.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSaved(false);
  }

  function setOptions(id: string, options: string[]) {
    update(id, { options });
  }

  function addOption(id: string, afterIndex?: number) {
    const q = questions.find((item) => item.id === id);
    const current = q?.options ?? [];
    const insertAt = afterIndex === undefined ? current.length : afterIndex + 1;
    const next = [...current];
    next.splice(insertAt, 0, `옵션 ${current.length + 1}`);
    setOptions(id, next);
    setFocusOption({ id, index: insertAt });
  }

  function changeOption(id: string, index: number, value: string) {
    const q = questions.find((item) => item.id === id);
    const current = [...(q?.options ?? [])];
    current[index] = value;
    setOptions(id, current);
  }

  function removeOption(id: string, index: number) {
    const q = questions.find((item) => item.id === id);
    const current = q?.options ?? [];
    if (current.length <= 1) return;
    setOptions(
      id,
      current.filter((_, i) => i !== index),
    );
  }

  async function save() {
    setSaving(true);
    // TODO(api): PATCH /api/studies/{studyId}/cohorts/{cohortId}/application-form
    await new Promise((r) => setTimeout(r, 400));
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-3'>
      <div data-anno='form:1'>
        <FormHeaderCard title={tx(study.title)} summary={tx(study.summary)} account={account} />
      </div>

      <section data-anno='form:2' className={formCardClass()}>
        <DiscordNicknameField stored={account.discordNickname} disabled />
      </section>

      <div data-anno='form:3' className='flex items-center justify-between gap-3'>
        <p className='text-xs text-fg-muted'>카드를 누르면 질문을 고칩니다. 모양은 지원자가 보는 작성 화면과 같습니다.</p>
        <Button data-anno='form:3-1' size='sm' variant='secondary' leadingIcon={<Plus size={15} />} onClick={add}>
          질문 추가
        </Button>
      </div>

      {questions.map((q, i) => {
        const selected = selectedId === q.id;
        return (
          <section
            key={q.id}
            data-anno='form:3-2'
            className={formCardClass(selected)}
            onClick={() => setSelectedId(q.id)}
          >
            {selected ? (
              <div className='flex items-start gap-2'>
                <div className='flex flex-col gap-0.5 pt-1.5'>
                  <button
                    type='button'
                    aria-label='위로 이동'
                    onClick={(ev) => {
                      ev.stopPropagation();
                      move(q.id, -1);
                    }}
                    disabled={i === 0}
                    className='text-fg-muted transition-colors hover:text-fg disabled:opacity-30'
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type='button'
                    aria-label='아래로 이동'
                    onClick={(ev) => {
                      ev.stopPropagation();
                      move(q.id, 1);
                    }}
                    disabled={i === questions.length - 1}
                    className='text-fg-muted transition-colors hover:text-fg disabled:opacity-30'
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <div className='flex min-w-0 flex-1 flex-col gap-3'>
                  <div className='grid gap-2 sm:grid-cols-[1fr_9rem]'>
                    <Input
                      value={q.label}
                      onChange={(ev) => update(q.id, { label: ev.target.value })}
                      placeholder={`질문 ${i + 1}`}
                    />
                    <Select
                      value={q.type}
                      onChange={(ev) => {
                        const type = ev.target.value as ApplicationQuestionType;
                        update(q.id, {
                          type,
                          options: needsOptions(type) ? seedOptions(q.options) : undefined,
                          allowOther: allowsOther(type) ? q.allowOther : undefined,
                        });
                      }}
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABEL[t]}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {needsOptions(q.type) ? (
                    <OptionEditor
                      type={q.type}
                      options={q.options ?? ['옵션 1']}
                      allowOther={Boolean(q.allowOther)}
                      focusIndex={focusOption?.id === q.id ? focusOption.index : undefined}
                      onChange={(index, value) => changeOption(q.id, index, value)}
                      onAdd={() => addOption(q.id)}
                      onAddAfter={(index) => addOption(q.id, index)}
                      onRemove={(index) => removeOption(q.id, index)}
                      onToggleOther={(on) => update(q.id, { allowOther: on })}
                    />
                  ) : (
                    <QuestionFillView q={q} ghost />
                  )}

                  <div className='flex items-center justify-between border-t border-border pt-3'>
                    <Checkbox
                      label='필수 응답'
                      checked={q.required}
                      onChange={(ev) => update(q.id, { required: ev.target.checked })}
                    />
                    <button
                      type='button'
                      onClick={(ev) => {
                        ev.stopPropagation();
                        remove(q.id);
                      }}
                      className='inline-flex items-center gap-1 text-xs font-semibold text-error-600 hover:underline'
                    >
                      <Trash2 size={13} /> 삭제
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className='pointer-events-none'>
                <QuestionFillView q={q} disabled />
              </div>
            )}
          </section>
        );
      })}

      <div className='flex items-center gap-3 pt-1'>
        {saved && <span className='text-sm font-medium text-success-700'>저장되었습니다.</span>}
        <Button data-anno='form:4' className='ml-auto' onClick={save} loading={saving}>
          저장
        </Button>
      </div>
    </div>
  );
}
