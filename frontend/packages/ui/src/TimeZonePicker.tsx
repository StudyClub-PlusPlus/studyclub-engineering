'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { Check, ChevronDown, Search } from 'lucide-react';

import { cx } from './cx';
import { controlClass, FieldShell, Input } from './Field';
import { POPOVER_PANEL, useAnchoredPopover } from './popover';

type PickerLocale = 'ko' | 'en';

const TEXT = {
  ko: {
    placeholder: '시간대를 선택해 주세요',
    search: '시간대 검색',
    searchHint: '도시 또는 국가 검색',
    empty: '검색 결과가 없습니다.',
  },
  en: {
    placeholder: 'Select a time zone',
    search: 'Search time zones',
    searchHint: 'Search city or country',
    empty: 'No time zones found.',
  },
} as const;

const SIZE = {
  sm: 'min-h-8 py-1 type-body-sm',
  md: 'min-h-10 py-2 type-label-lg',
  lg: 'min-h-12 py-2.5 type-label-lg',
} as const;

/** 목록 한 줄. 지역 이름 · UTC 차이 같은 글은 앱이 만든다 — 시간대 이름표는 앱마다 다르다. */
export interface TimeZoneOption {
  /** IANA 지역 ID(Asia/Seoul) */
  value: string;
  label: string;
  /** 이름 아래 작은 글씨(UTC+09:00 등) */
  detail?: string;
  /** 같은 group 이 이어지면 머리글 하나 아래 묶는다(국가 등). */
  group?: string;
  /** 고른 뒤 칸에 보일 이름. 묶음 머리글 아래 도시 이름만 쓰는 줄은 「국가 · 도시」로 넘긴다. 기본은 label. */
  selectedLabel?: string;
  /** 검색에 더 걸릴 말(별칭 · 영문 이름). label · value 는 늘 걸린다. */
  keywords?: string;
}

/**
 * design-system.md §9-2 Time Zone Picker — 칸을 누르면 아래에 시간대 목록이 뜨고, 목록이 길면 맨 위 검색 칸으로 좁힌다.
 * 방향키로 옮기고 Enter 로 고른다. 바깥 클릭 · 포커스 이동 · Esc 로 닫히고, Esc 는 칸으로 포커스를 되돌린다.
 */
export interface TimeZonePickerProps {
  value: string;
  onChange: (zone: string) => void;
  options: readonly TimeZoneOption[];
  label?: string;
  /** 카드 칸처럼 이미 제목이 있는 자리 — 라벨은 스크린리더용으로만 남긴다. */
  hideLabel?: boolean;
  helper?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** sm 32 은 제목 줄 · 툴바에서 Button sm 과 높이를 맞출 때 */
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  /** 검색 칸. 기본은 목록이 7개 이상일 때. */
  searchable?: boolean;
  /** 목록 아래 덧붙이는 단추(「전체 시간대에서 찾기」 등). */
  footer?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  locale?: PickerLocale;
  id?: string;
  className?: string;
  [data: `data-${string}`]: string | undefined;
}

export function TimeZonePicker({
  value,
  onChange,
  options,
  label,
  hideLabel,
  helper,
  error,
  required,
  disabled,
  size = 'lg',
  placeholder,
  searchable,
  footer,
  onOpenChange,
  locale = 'ko',
  id: idProp,
  className,
  ...data
}: TimeZonePickerProps) {
  const t = TEXT[locale];
  const autoId = useId();
  const id = idProp ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const withSearch = searchable ?? options.length > 6;
  const selected = options.find((o) => o.value === value);
  const selectedName = selected ? (selected.selectedLabel ?? selected.label) : undefined;
  const name = label ?? (locale === 'ko' ? '시간대' : 'Time zone');
  const messageId = error || helper ? `${id}-message` : undefined;

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  useAnchoredPopover({ open, onClose: close, rootRef, anchorRef: triggerRef, panelRef, matchWidth: true });

  const matches = useMemo(() => {
    const words = query.trim().replaceAll('_', ' ').toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((o) => {
      const text = `${o.value} ${o.label} ${o.group ?? ''} ${o.keywords ?? ''}`
        .replaceAll('_', ' ')
        .toLocaleLowerCase();
      return words.every((word) => text.includes(word));
    });
  }, [options, query]);

  // 열려 있는 동안 목록이 짧아지면(전체 시간대 → 회원 시간대) 고를 줄이 목록 안에 남게 한다.
  useEffect(() => setActive((v) => Math.min(v, Math.max(0, matches.length - 1))), [matches.length]);

  useEffect(() => {
    if (!open) return;
    (withSearch ? document.getElementById(`${id}-search`) : listRef.current)?.focus();
  }, [open, withSearch, id]);

  useEffect(() => {
    const list = listRef.current;
    const item = document.getElementById(`${id}-option-${active}`);
    if (!open || !list || !item) return;
    // 묶음의 첫 줄이면 머리글까지 보이게 굴린다.
    const heading = item.previousElementSibling;
    const target = heading?.hasAttribute('data-group-heading') ? heading : item;
    const top = target.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop;
    const bottom = item.getBoundingClientRect().bottom - list.getBoundingClientRect().top + list.scrollTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [active, open, id, matches]);

  function show() {
    setQuery('');
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  }

  function select(zone: string) {
    onChange(zone);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onListKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((v) => Math.min(v + 1, Math.max(0, matches.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((v) => Math.max(v - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (matches[active]) select(matches[active].value);
    }
  }

  const activeId = matches[active] ? `${id}-option-${active}` : undefined;
  const rows: ReactNode[] = [];
  matches.forEach((o, index) => {
    if (o.group && o.group !== matches[index - 1]?.group) {
      rows.push(
        <div
          key={`group-${o.group}-${index}`}
          data-group-heading
          role='presentation'
          className='bg-surface-2 px-3 py-1.5 type-label-sm font-semibold text-fg-muted'
        >
          {o.group}
        </div>,
      );
    }
    rows.push(
      <div
        key={o.value}
        id={`${id}-option-${index}`}
        role='option'
        aria-selected={o.value === value}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActive(index)}
        onClick={() => select(o.value)}
        className={cx(
          'flex cursor-pointer items-center justify-between gap-2 rounded-control px-3 py-2 text-left',
          active === index && 'bg-primary-light',
        )}
      >
        <span className='min-w-0'>
          <span className='block type-label-lg font-semibold text-ink'>{o.label}</span>
          {o.detail && <span className='mt-0.5 block type-label-sm text-fg-muted'>{o.detail}</span>}
        </span>
        {o.value === value && <Check size={16} className='shrink-0 text-brand' aria-hidden='true' />}
      </div>,
    );
  });

  return (
    <div ref={rootRef} className={className} {...data}>
      <FieldShell
        label={hideLabel ? undefined : label}
        helper={helper}
        error={error}
        required={required}
        htmlFor={`${id}-trigger`}
        messageId={messageId}
      >
        <button
          ref={triggerRef}
          id={`${id}-trigger`}
          type='button'
          disabled={disabled}
          // 라벨을 숨기면 이름 · 지금 값을 함께 읽힌다(「시간대 한국 · 서울」). 이름만으로도 찾을 수 있게 따로 둔다
          aria-labelledby={hideLabel ? `${id}-name ${id}-value` : undefined}
          aria-haspopup='listbox'
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={messageId}
          onClick={() => (open ? setOpen(false) : show())}
          onKeyDown={(event) => {
            if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
              event.preventDefault();
              show();
            }
          }}
          className={controlClass(Boolean(error), cx(SIZE[size], 'flex items-center justify-between gap-3 text-left'))}
        >
          {hideLabel && (
            <span id={`${id}-name`} className='sr-only'>
              {name}
            </span>
          )}
          <span
            id={`${id}-value`}
            title={selectedName}
            className={cx('min-w-0 truncate', selected ? 'text-ink' : 'text-fg-placeholder')}
          >
            {selectedName ?? placeholder ?? t.placeholder}
          </span>
          <ChevronDown
            size={16}
            aria-hidden='true'
            className={cx('shrink-0 text-fg-muted transition-transform duration-fast', open && 'rotate-180')}
          />
        </button>
      </FieldShell>
      {open && (
        <div
          ref={panelRef}
          className={cx(POPOVER_PANEL, 'p-1.5')}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            triggerRef.current?.focus();
          }}
        >
          {withSearch && (
            <div className='p-1.5'>
              <Input
                id={`${id}-search`}
                size='sm'
                role='combobox'
                leadingIcon={<Search size={14} />}
                aria-label={t.search}
                aria-expanded={open}
                aria-controls={`${id}-list`}
                aria-autocomplete='list'
                aria-activedescendant={activeId}
                placeholder={t.searchHint}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onListKey}
              />
            </div>
          )}
          <div
            ref={listRef}
            id={`${id}-list`}
            role='listbox'
            aria-label={name}
            tabIndex={withSearch ? undefined : 0}
            aria-activedescendant={withSearch ? undefined : activeId}
            onKeyDown={withSearch ? undefined : onListKey}
            className='max-h-64 overflow-y-auto focus-visible:outline-none'
          >
            {rows}
          </div>
          {matches.length === 0 && (
            <p role='status' className='px-3 py-2.5 type-label-sm text-fg-muted'>
              {t.empty}
            </p>
          )}
          {footer && <div className='mt-1.5 border-t border-border pt-1.5'>{footer}</div>}
        </div>
      )}
    </div>
  );
}
