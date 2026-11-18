'use client';

import { useId } from 'react';

import { cx } from './cx';
import { FieldShell, Select } from './Field';
import type { SelectSize } from './Field';

const pad = (n: number) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, h) => pad(h));

/**
 * design-system.md §9-2 Time Select. 시(00~23) · 분 두 칸으로 고르는 시각 입력.
 * 브라우저 기본 `<input type="time">` 은 OS·언어마다 칸 모양이 달라(오전/오후 칸이 초처럼 보이는 등) 쓰지 않는다.
 * 값은 `HH:mm`(24시간) 문자열, 비었으면 `''`.
 */
export interface TimeSelectProps {
  /** `HH:mm` 또는 `''` */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helper?: string;
  error?: string;
  required?: boolean;
  /** 보이는 라벨이 없을 때(표 칸) 묶음 이름. 두 칸은 「… 시」 · 「… 분」 으로 읽힌다 */
  'aria-label'?: string;
  size?: SelectSize;
  /** 분 칸 간격. 기본 5분. 지금 값이 간격에 안 맞아도 그 분은 목록에 남긴다 */
  minuteStep?: number;
  disabled?: boolean;
  className?: string;
}

export function TimeSelect({
  value,
  onChange,
  label,
  helper,
  error,
  required,
  'aria-label': ariaLabel,
  size = 'md',
  minuteStep = 5,
  disabled,
  className,
}: TimeSelectProps) {
  const id = useId();
  const name = label ?? ariaLabel ?? '시각';
  const [hour = '', minute = ''] = value ? value.split(':') : [];
  const steps = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => pad(i * minuteStep));
  const minutes = minute && !steps.includes(minute) ? [...steps, minute].sort() : steps;
  const invalid = Boolean(error);

  return (
    <FieldShell label={label} helper={helper} error={error} required={required} htmlFor={`${id}-h`}>
      <div role='group' aria-label={name} className={cx('flex items-center gap-1.5', className)}>
        <div className='min-w-0 flex-1'>
          <Select
            id={`${id}-h`}
            aria-label={`${name} 시`}
            aria-invalid={invalid || undefined}
            size={size}
            disabled={disabled}
            required={required}
            value={hour}
            onChange={(e) => onChange(e.target.value ? `${e.target.value}:${minute || '00'}` : '')}
          >
            <option value=''>시</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </div>
        <span aria-hidden='true' className='type-body-md text-fg-muted'>
          :
        </span>
        <div className='min-w-0 flex-1'>
          <Select
            aria-label={`${name} 분`}
            aria-invalid={invalid || undefined}
            size={size}
            disabled={disabled || !hour}
            value={minute}
            onChange={(e) => onChange(`${hour}:${e.target.value}`)}
          >
            {!minute && <option value=''>분</option>}
            {minutes.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </FieldShell>
  );
}
