'use client';

import { useState } from 'react';

import {
  cohortTitle,
  daysIn,
  isoDay,
  nextMonth,
  shortDate,
  type ClubConfig,
  type Month,
} from '@console/lib/clubs';
import { Badge, Button, Modal, Select, Switch } from '@studyclub/ui';
import { Plus } from 'lucide-react';

/**
 * 클럽 기수 — 이번 기수와 다음 기수.
 *
 * 다음 기수는 **반자동**이다. 정한 날(기본 15일)에 다음 달 기수 초안이 미공개로 만들어지고,
 * 캡틴이 내용을 확인한 뒤 「모집 시작」을 누르면 사이트에 공개되며 모집이 열린다.
 * TODO(api): 초안은 서버 스케줄러가 만든다 — POST 없이 GET /api/admin/clubs/{programId} 가 다음 기수를 함께 준다
 */

export type NextState = 'none' | 'draft' | 'recruiting';

export type AutoDraft = { on: boolean; day: number };

export function ClubCohortPanel({
  club,
  current,
  today,
  memberCount,
  next,
  carryCount,
  applicants,
  auto,
  onAutoChange,
  onCreate,
  onStartRecruit,
}: {
  club: ClubConfig;
  /** 이번 기수의 달 */
  current: Month;
  today: string;
  /** 이번 기수 참여 중 인원 */
  memberCount: number;
  next: NextState;
  /** 다음 기수로 넘어갈 예정 인원 */
  carryCount: number;
  /** 다음 기수 신청 인원 (모집 시작 뒤) */
  applicants: number;
  auto: AutoDraft;
  onAutoChange: (next: AutoDraft) => void;
  onCreate: () => void;
  onStartRecruit: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const nm = nextMonth(current);
  const curEnd = isoDay(current, daysIn(current));
  const nextStart = isoDay(nm, 1);
  const nextEnd = isoDay(nm, daysIn(nm));
  const draftOn = isoDay(current, auto.day);
  const dday = Math.round((Date.parse(curEnd) - Date.parse(today)) / 86_400_000);
  const seats = club.capacity === undefined ? undefined : Math.max(club.capacity - carryCount - applicants, 0);

  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      {/* 이번 기수 */}
      <section data-anno='cohort:1' className='card px-5 py-4'>
        <div className='flex items-center justify-between gap-2'>
          <p className='type-label-sm text-fg-muted'>이번 기수</p>
          <span data-anno='cohort:1-1'>
            <Badge tone='inprogress' dot>
              진행 중
            </Badge>
          </span>
        </div>
        <h2 className='mt-1 type-title-lg text-fg'>{cohortTitle(club, current)}</h2>
        <dl className='mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 type-body-sm'>
          <dt className='text-fg-muted'>진행</dt>
          <dd data-anno='cohort:1-2' className='tnum text-fg'>
            {shortDate(isoDay(current, 1))} ~ {shortDate(curEnd)}
          </dd>
          <dt className='text-fg-muted'>참여 중</dt>
          <dd data-anno='cohort:1-3' className='tnum text-fg'>
            {memberCount}명
          </dd>
        </dl>
      </section>

      {/* 다음 기수 */}
      <section data-anno='cohort:2' className='card px-5 py-4'>
        <div className='flex items-center justify-between gap-2'>
          <p className='type-label-sm text-fg-muted'>다음 기수</p>
          <span data-anno='cohort:2-1'>
            {next === 'draft' && <Badge tone='closingsoon'>초안 · 미공개</Badge>}
            {next === 'recruiting' && (
              <Badge tone='recruiting' dot>
                모집중 · D-{dday}
              </Badge>
            )}
            {next === 'none' && <Badge tone='neutral'>아직 없음</Badge>}
          </span>
        </div>
        <h2 className='mt-1 type-title-lg text-fg'>{cohortTitle(club, nm)}</h2>

        {next === 'none' ? (
          <div className='mt-3'>
            <p data-anno='cohort:2-5' className='type-body-sm text-fg-secondary'>
              {auto.on
                ? `${shortDate(draftOn)}에 초안이 자동으로 만들어집니다.`
                : '자동 초안이 꺼져 있습니다. 직접 만들어 주세요.'}
            </p>
            <Button
              data-anno='cohort:2-6'
              className='mt-3'
              size='sm'
              variant='secondary'
              leadingIcon={<Plus size={14} />}
              onClick={onCreate}
            >
              지금 초안 만들기
            </Button>
          </div>
        ) : (
          <>
            <dl data-anno='cohort:2-2' className='mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 type-body-sm'>
              <dt className='text-fg-muted'>진행</dt>
              <dd className='tnum text-fg'>
                {shortDate(nextStart)} ~ {shortDate(nextEnd)}
              </dd>
              <dt className='text-fg-muted'>모집</dt>
              <dd className='tnum text-fg'>
                {next === 'recruiting' ? `${shortDate(today)} ~ ${shortDate(curEnd)}` : `모집 시작한 날 ~ ${shortDate(curEnd)}`}
              </dd>
              <dt className='text-fg-muted'>정원</dt>
              <dd className='tnum text-fg'>
                {club.capacity === undefined ? '제한 없음' : `${club.capacity}명 · 남은 자리 ${seats}`}
              </dd>
              <dt className='text-fg-muted'>신청 폼</dt>
              <dd className='text-fg'>
                이번 기수 폼 그대로{club.extra ? ` · 「${club.extra.label}」 필수` : ''}
              </dd>
              {next === 'recruiting' && (
                <>
                  <dt className='text-fg-muted'>신청</dt>
                  <dd className='tnum text-fg'>{applicants}명</dd>
                </>
              )}
              <dt className='text-fg-muted'>이어서 참여</dt>
              <dd className='tnum text-fg'>{carryCount}명 예정</dd>
            </dl>
            {next === 'draft' && (
              <Button data-anno='cohort:2-3' className='mt-4' size='sm' onClick={() => setConfirm(true)}>
                모집 시작
              </Button>
            )}
          </>
        )}
      </section>

      {/* 자동 초안 설정 */}
      <section data-anno='cohort:3' className='card flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 lg:col-span-2'>
        <span data-anno='cohort:3-1'>
          <Switch
            label='다음 기수 초안 자동 만들기'
            checked={auto.on}
            onCheckedChange={(on) => onAutoChange({ ...auto, on })}
          />
        </span>
        <span data-anno='cohort:3-2' className='flex items-center gap-2 type-body-sm text-fg-secondary'>
          매월
          <Select
            size='sm'
            aria-label='초안 만드는 날'
            disabled={!auto.on}
            value={String(auto.day)}
            onChange={(e) => onAutoChange({ ...auto, day: Number(e.target.value) })}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </Select>
          에 다음 달 기수 초안을 만듭니다
        </span>
      </section>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title='모집 시작'
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setConfirm(false)}>
              취소
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
                onStartRecruit();
              }}
            >
              모집 시작
            </Button>
          </>
        }
      >
        <div data-anno='cohort:2-4' className='py-4 text-center'>
          <p className='type-label-lg text-fg'>‘{cohortTitle(club, nm)}’ 모집을 시작하시겠습니까?</p>
          <p className='mt-1.5 type-body-sm text-fg-muted'>
            사용자 사이트에 공개되고 오늘부터 {shortDate(curEnd)}까지 신청을 받습니다.
          </p>
        </div>
      </Modal>
    </div>
  );
}
