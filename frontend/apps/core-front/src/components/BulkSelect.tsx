'use client';

import { useRef, useState } from 'react';

import { Select } from '@studyclub/ui';

/**
 * 작업 바의 일괄 변경 드롭다운 — 「적용」 버튼 없이 고르면 반영한다 (POL-0008, 10-18 D2).
 *
 * 접힌 네이티브 select 는 화살표 키를 누를 때마다 change 를 낸다(Windows). 그때마다 반영하면
 * 키보드로 목록을 훑기만 해도 첫 항목이 고른 사람 전원에게 얹힌다. 그래서
 * - 마우스로 고르면 바로 반영한다
 * - 키보드로 옮기는 동안은 보이기만 하고, Enter 를 누르거나 칸을 떠날 때 반영한다. Esc 는 미리 본 값을 버린다
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
  const keyboard = useRef(false);
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
      onPointerDown={() => {
        keyboard.current = false;
      }}
      onKeyDown={(e) => {
        keyboard.current = true;
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(pending);
        }
        if (e.key === 'Escape') setPending('');
      }}
      onChange={(e) => (keyboard.current ? setPending(e.target.value) : commit(e.target.value))}
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
