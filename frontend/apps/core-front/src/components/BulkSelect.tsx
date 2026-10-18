'use client';

import { useRef, useState } from 'react';

import { Select } from '@studyclub/ui';

/**
 * 작업 바의 일괄 변경 드롭다운 — 「적용」 버튼 없이 고르면 반영한다 (POL-0008, 10-18 D2).
 *
 * 접힌 네이티브 select 는 화살표 · 글자 키를 누를 때마다 값을 바꾸고 change 를 낸다(Windows 등). 그때마다 반영하면
 * 키보드로 목록을 훑기만 해도 첫 항목이 고른 사람 전원에게 얹힌다. 그래서
 * - 키를 누른 바로 그 순간에 바뀐 값은 보이기만 하고, Enter 를 누르거나 칸을 떠날 때 반영한다. Esc 는 미리 본 값을 버린다
 * - 그 밖의 change 는 바로 반영한다 — 마우스로 고를 때, 그리고 펼친 목록에서 고를 때(macOS 는 화살표 · 스페이스가
 *   목록을 펼치고, 펼친 목록 안의 키는 페이지에 오지 않은 채 고르는 순간 change 만 온다)
 * 반영하면 처음 글(placeholder)로 돌아온다 — 같은 값을 또 고를 수 있다.
 *
 * 동작 정본은 playground 프로토 `BulkSelect`. packages/ui 일괄 선택 부품이 생기면 그것으로 바꾼다 (10-18 FE 할 일).
 */
export function BulkSelect({
  label,
  placeholder,
  options,
  disabled,
  onPick,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onPick: (value: string) => void;
}) {
  const [pending, setPending] = useState('');
  /** 방금 누른 키가 접힌 select 의 값을 바로 바꾸는 중인가 — 키를 누른 그 작업(task) 동안만 켜 둔다. */
  const keyStep = useRef(false);
  function commit(v: string) {
    setPending('');
    if (v) onPick(v);
  }
  return (
    <Select
      aria-label={label}
      size='sm'
      disabled={disabled}
      value={pending}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(pending);
          return;
        }
        if (e.key === 'Escape') {
          setPending('');
          return;
        }
        if (e.key === 'Tab') return;
        // 값이 바로 바뀌는 플랫폼에서는 이 키의 change 가 지금 작업 안에서 온다. 다음 작업에서 끈다
        keyStep.current = true;
        setTimeout(() => {
          keyStep.current = false;
        }, 0);
      }}
      onChange={(e) => (keyStep.current ? setPending(e.target.value) : commit(e.target.value))}
      onBlur={() => pending && commit(pending)}
    >
      <option value=''>{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}
