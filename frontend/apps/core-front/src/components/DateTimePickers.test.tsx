import { useState } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DatePicker } from '../../../../packages/ui/src/DatePicker';
import { Modal } from '../../../../packages/ui/src/Modal';
import { TimePicker } from '../../../../packages/ui/src/TimePicker';
import { TimeZonePicker } from '../../../../packages/ui/src/TimeZonePicker';
import type { TimeZoneOption } from '../../../../packages/ui/src/TimeZonePicker';

function Date_(props: {
  initial?: string;
  min?: string;
  max?: string;
  required?: boolean;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <DatePicker
      label='시작 일자'
      today='2026-11-23'
      min={props.min}
      max={props.max}
      required={props.required}
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange?.(v);
      }}
    />
  );
}

describe('DatePicker', () => {
  it('칸에 친 날짜는 다 쳤을 때만 값으로 올리고, 숫자 8자리는 YYYY-MM-DD 로 맞춘다', async () => {
    const onChange = vi.fn();
    render(<Date_ onChange={onChange} />);
    const input = screen.getByLabelText('시작 일자');
    await userEvent.type(input, '2026-11-0');
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.type(input, '5');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-05');
    await userEvent.clear(input);
    expect(onChange).toHaveBeenLastCalledWith('');
    await userEvent.type(input, '20270102');
    expect(input).toHaveValue('2027-01-02');
    expect(onChange).toHaveBeenLastCalledWith('2027-01-02');
  });

  it('없는 날짜를 치다 칸을 떠나면 마지막 값으로 돌아간다', async () => {
    const onChange = vi.fn();
    render(<Date_ initial='2026-11-23' onChange={onChange} />);
    const input = screen.getByLabelText('시작 일자');
    fireEvent.change(input, { target: { value: '2026-02-30' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input).toHaveValue('2026-11-23');
  });

  it('달력에서 고르면 값이 바뀌고 창이 닫혀 칸으로 포커스가 돌아온다', async () => {
    render(<Date_ initial='2026-11-23' />);
    await userEvent.click(screen.getByRole('button', { name: '시작 일자 달력 열기' }));
    const dialog = screen.getByRole('dialog', { name: '시작 일자 날짜 고르기' });
    expect(within(dialog).getByText('2026년 11월')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /11월 23일/ })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole('button', { name: /11월 5일/ }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('시작 일자')).toHaveValue('2026-11-05');
    expect(screen.getByLabelText('시작 일자')).toHaveFocus();
  });

  it('방향키 · PageDown 으로 날짜를 옮기고 Enter 로 고른다. 31일에서 다음 달은 말일에 선다', async () => {
    render(<Date_ initial='2027-01-31' />);
    await userEvent.click(screen.getByRole('button', { name: '시작 일자 달력 열기' }));
    await userEvent.keyboard('{PageDown}');
    expect(screen.getByRole('button', { name: /2월 28일/ })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(screen.getByLabelText('시작 일자')).toHaveValue('2027-03-01');
  });

  it('min · max 밖의 날은 막고, 필수가 아니면 지우기를 둔다', async () => {
    render(<Date_ initial='2026-11-23' min='2026-11-10' max='2026-11-25' />);
    await userEvent.click(screen.getByRole('button', { name: '시작 일자 달력 열기' }));
    expect(screen.getByRole('button', { name: /11월 9일/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /11월 26일/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '지우기' }));
    expect(screen.getByLabelText('시작 일자')).toHaveValue('');
  });

  it('달력 창은 달력 단추 바로 아래에 단추 오른쪽 끝을 맞춰 뜨고, 아래 자리가 모자라면 위로 뜬다', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1200);
    let viewportHeight = 900;
    let buttonTop = 300;
    vi.spyOn(window, 'innerHeight', 'get').mockImplementation(() => viewportHeight);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const r = (left: number, top: number, width: number, height: number) =>
        ({
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          x: left,
          y: top,
          toJSON() {},
        }) as DOMRect;
      if (this.getAttribute('role') === 'dialog')
        return r(parseFloat(this.style.left || '0'), parseFloat(this.style.top || '0'), 288, 400);
      if (this.getAttribute('aria-haspopup') === 'dialog') return r(876, buttonTop, 24, 24);
      return r(400, 290, 500, 44);
    });
    const { unmount } = render(<Date_ initial='2026-11-23' />);
    await userEvent.click(screen.getByRole('button', { name: '시작 일자 달력 열기' }));
    expect(screen.getByRole('dialog')).toHaveStyle({ left: `${900 - 288}px`, top: `${324 + 6}px` });
    unmount();
    viewportHeight = 700;
    buttonTop = 500;
    render(<Date_ initial='2026-11-23' />);
    await userEvent.click(screen.getByRole('button', { name: '시작 일자 달력 열기' }));
    expect(screen.getByRole('dialog')).toHaveStyle({ top: `${500 - 6 - 400}px` });
    vi.restoreAllMocks();
  });

  it('흐림(backdrop-filter) 머리 안처럼 fixed 기준이 화면이 아니어도 단추 옆에 뜬다', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1200);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(900);
    // 부모가 fixed 의 기준이 되어 style 값보다 (300, 40) 만큼 밀려 그려진다
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const r = (left: number, top: number, width: number, height: number) =>
        ({
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          x: left,
          y: top,
          toJSON() {},
        }) as DOMRect;
      if (this.getAttribute('role') === 'dialog')
        return r(parseFloat(this.style.left || '0') + 300, parseFloat(this.style.top || '0') + 40, 288, 400);
      if (this.getAttribute('aria-haspopup') === 'dialog') return r(876, 300, 24, 24);
      return r(400, 290, 500, 44);
    });
    render(<Date_ initial='2026-11-23' />);
    await userEvent.click(screen.getByRole('button', { name: '시작 일자 달력 열기' }));
    expect(screen.getByRole('dialog')).toHaveStyle({ left: `${900 - 288 - 300}px`, top: `${330 - 40}px` });
    vi.restoreAllMocks();
  });

  it('Esc 는 달력만 닫고 바깥(모달)으로 새지 않는다', async () => {
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    render(<Date_ initial='2026-11-23' required />);
    await userEvent.click(screen.getByRole('button', { name: '시작 일자 달력 열기' }));
    expect(screen.queryByRole('button', { name: '지우기' })).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(outer).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
    document.removeEventListener('keydown', outer);
  });
});

function Time_(props: { initial?: string; minuteStep?: number }) {
  const [value, setValue] = useState(props.initial ?? '');
  return <TimePicker label='시작 시각' minuteStep={props.minuteStep} value={value} onChange={setValue} />;
}

describe('TimePicker', () => {
  it('칸에 친 시각은 HH:mm 이 되면 값으로 올리고, 숫자 4자리는 HH:mm 으로 맞춘다', async () => {
    render(<Time_ />);
    const input = screen.getByLabelText('시작 시각');
    await userEvent.type(input, '2030');
    expect(input).toHaveValue('20:30');
    fireEvent.change(input, { target: { value: '25:00' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('20:30');
  });

  it('시를 고르면 분 목록으로 넘어가고, 분을 고르면 닫힌다', async () => {
    render(<Time_ initial='09:00' minuteStep={15} />);
    await userEvent.click(screen.getByRole('button', { name: '시작 시각 시각 목록 열기' }));
    const hours = screen.getByRole('listbox', { name: '시작 시각 시' });
    expect(within(hours).getByRole('option', { name: '09' })).toHaveFocus();
    await userEvent.click(within(hours).getByRole('option', { name: '20' }));
    expect(screen.getByLabelText('시작 시각')).toHaveValue('20:00');
    const minutes = screen.getByRole('listbox', { name: '시작 시각 분' });
    expect(
      within(minutes)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['00', '15', '30', '45']);
    await userEvent.click(within(minutes).getByRole('option', { name: '45' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('시작 시각')).toHaveValue('20:45');
  });

  it('간격에 안 맞는 지금 분도 목록에 남긴다', async () => {
    render(<Time_ initial='19:07' minuteStep={15} />);
    await userEvent.click(screen.getByRole('button', { name: '시작 시각 시각 목록 열기' }));
    const minutes = screen.getByRole('listbox', { name: '시작 시각 분' });
    expect(within(minutes).getByRole('option', { name: '07' })).toHaveAttribute('aria-selected', 'true');
  });
});

const ZONES: TimeZoneOption[] = [
  { value: 'Asia/Seoul', label: '서울', group: '한국', detail: 'UTC+09:00' },
  { value: 'America/New_York', label: '뉴욕', group: '미국' },
  { value: 'America/Los_Angeles', label: '로스앤젤레스', group: '미국', keywords: 'LA 엘에이' },
  { value: 'America/Toronto', label: '토론토', group: '캐나다' },
  { value: 'America/Vancouver', label: '밴쿠버', group: '캐나다' },
  { value: 'Europe/London', label: '런던', group: '영국' },
  { value: 'Australia/Sydney', label: '시드니', group: '오스트레일리아' },
];

function Zone_(props: { options?: TimeZoneOption[] }) {
  const [value, setValue] = useState('Asia/Seoul');
  return <TimeZonePicker label='나의 시간대' options={props.options ?? ZONES} value={value} onChange={setValue} />;
}

describe('TimeZonePicker', () => {
  it('별칭으로 검색해 Enter 로 고르면 닫히고 칸으로 포커스가 돌아온다', async () => {
    render(<Zone_ />);
    await userEvent.click(screen.getByLabelText('나의 시간대'));
    const search = screen.getByRole('combobox', { name: '시간대 검색' });
    expect(search).toHaveFocus();
    await userEvent.type(search, '엘에이');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText('나의 시간대')).toHaveTextContent('로스앤젤레스');
    expect(screen.getByLabelText('나의 시간대')).toHaveFocus();
  });

  it('같은 묶음은 머리글 하나 아래 놓고, 결과가 없으면 알린다', async () => {
    render(<Zone_ />);
    await userEvent.click(screen.getByLabelText('나의 시간대'));
    expect(screen.getAllByText('미국')).toHaveLength(1);
    await userEvent.type(screen.getByRole('combobox'), '파리');
    expect(screen.getByRole('status')).toHaveTextContent('검색 결과가 없습니다.');
  });

  it('목록이 짧으면 검색 칸 없이 목록에서 방향키로 고른다', async () => {
    render(<Zone_ options={ZONES.slice(0, 3)} />);
    await userEvent.click(screen.getByLabelText('나의 시간대'));
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByRole('listbox')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByLabelText('나의 시간대')).toHaveTextContent('뉴욕');
  });
});

describe('창(Modal) 안의 팝오버', () => {
  // Next 앱은 React 이벤트를 document 에 달아, 팝오버의 stopPropagation 이 같은 document 의 Modal 리스너를 막지 못한다.
  // 그래서 팝오버는 Esc 를 preventDefault 로 표시하고, Modal 은 표시된 Esc 를 넘긴다.
  it('안에서 이미 처리한 Esc 로는 창을 닫지 않는다', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title='스터디 등록'>
        <input aria-label='안쪽 칸' onKeyDown={(event) => event.key === 'Escape' && event.preventDefault()} />
      </Modal>,
    );
    screen.getByLabelText('안쪽 칸').focus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    screen.getByRole('button', { name: /닫기/ }).focus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('달력을 Esc 로 닫아도 창은 남는다', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title='스터디 등록'>
        <Date_ initial='2026-11-23' />
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: '시작 일자 달력 열기' }));
    expect(screen.getByRole('dialog', { name: '시작 일자 날짜 고르기' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: '시작 일자 날짜 고르기' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
