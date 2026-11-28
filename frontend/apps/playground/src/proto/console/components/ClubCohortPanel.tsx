'use client';

import Link from 'next/link';
import { useState } from 'react';

import { cohortTitle, daysIn, isoDay, nextMonth, shortDate, type ClubConfig, type Month } from '@console/lib/clubs';
import { Badge, Button, ButtonLink, Modal, Select, Switch } from '@studyclub/ui';
import { Plus } from 'lucide-react';

/**
 * 클럽 기수 — 이번 기수와 다음 기수.
 *
 * 다음 기수는 **자동**이다. 정한 날(기본 15일)에 다음 달 기수가 미공개 초안으로 만들어지고,
 * 공개하는 날(기본 20일)에 사이트에 공개되며 모집이 열린다. 그 사이에 캡틴이 내용을 확인하고 고친다.
 * 캡틴은 「모집 시작」으로 먼저 열 수 있다.
 * TODO(api): 초안 · 공개는 서버 스케줄러가 한다 — GET /api/admin/clubs/{programId} 가 다음 기수를 함께 준다
 */

export type NextState = 'none' | 'draft' | 'recruiting';

/** 자동 초안 · 자동 공개 — day 에 초안, publishDay 에 공개 */
export type AutoDraft = { on: boolean; day: number; publishDay: number };

export function ClubCohortPanel({
  club,
  current,
  today,
  memberCount,
  next,
  recruitFrom,
  carryCount,
  applicants,
  auto,
  onAutoChange,
  onCreate,
  onStartRecruit,
  studyId,
}: {
  club: ClubConfig;
  /** 이번 기수의 달 */
  current: Month;
  today: string;
  /** 이번 기수 참여 중 인원 */
  memberCount: number;
  next: NextState;
  /** 모집 시작일 — 캡틴이 먼저 열었으면 그날, 아니면 자동 공개 날 */
  recruitFrom: string;
  /** 다음 기수로 넘어갈 예정 인원 */
  carryCount: number;
  /** 다음 기수 신청 인원 (모집 시작 뒤) */
  applicants: number;
  auto: AutoDraft;
  onAutoChange: (next: AutoDraft) => void;
  onCreate: () => void;
  onStartRecruit: () => void;
  /** 이번 기수의 스터디 상세 — 신청 폼 · 신청자는 그 화면이 맡는다 */
  studyId?: number;
}) {
  const [confirm, setConfirm] = useState(false);
  const nm = nextMonth(current);
  const curEnd = isoDay(current, daysIn(current));
  const nextStart = isoDay(nm, 1);
  const nextEnd = isoDay(nm, daysIn(nm));
  const draftOn = isoDay(current, auto.day);
  const publishOn = isoDay(current, auto.publishDay);
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
        {studyId !== undefined && (
          <ButtonLink
            data-anno='cohort:1-4'
            className='mt-4'
            size='sm'
            variant='secondary'
            linkAs={Link}
            href={`/proto/console/studies/${studyId}?tab=crew`}
          >
            신청자 · 명단
          </ButtonLink>
        )}
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
                ? `${shortDate(draftOn)}에 초안이 만들어지고 ${shortDate(publishOn)}에 자동으로 공개됩니다.`
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
                {next === 'recruiting' || auto.on
                  ? `${shortDate(recruitFrom)} ~ ${shortDate(curEnd)}`
                  : `모집 시작한 날 ~ ${shortDate(curEnd)}`}
              </dd>
              <dt className='text-fg-muted'>정원</dt>
              <dd className='tnum text-fg'>
                {club.capacity === undefined ? '제한 없음' : `${club.capacity}명 · 남은 자리 ${seats}`}
              </dd>
              <dt className='text-fg-muted'>신청 폼</dt>
              <dd className='text-fg'>
                이번 기수 폼 그대로{club.rosterQuestion ? ` · 「${club.rosterQuestion.label}」 명단에 보이기` : ''}
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
              <p data-anno='cohort:2-8' className='mt-3 type-body-sm text-fg-secondary'>
                {auto.on
                  ? `${shortDate(publishOn)}에 자동으로 공개되고 모집이 열립니다. 먼저 열려면 「모집 시작」을 누르세요.`
                  : '자동 공개가 꺼져 있습니다. 내용을 확인하고 「모집 시작」을 누르세요.'}
              </p>
            )}
            <div className='mt-4 flex flex-wrap gap-2'>
              {next === 'draft' && (
                <Button data-anno='cohort:2-3' size='sm' onClick={() => setConfirm(true)}>
                  모집 시작
                </Button>
              )}
              {/* TODO(api): 다음 기수의 study_id — 프로토는 이번 기수 화면의 신청 폼 탭을 연다 */}
              {studyId !== undefined && (
                <ButtonLink
                  data-anno='cohort:2-7'
                  size='sm'
                  variant='secondary'
                  linkAs={Link}
                  href={`/proto/console/studies/${studyId}?tab=form`}
                >
                  신청 폼
                </ButtonLink>
              )}
            </div>
          </>
        )}
      </section>

      {/* 자동 초안 설정 */}
      <section
        data-anno='cohort:3'
        className='card flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 lg:col-span-2'
      >
        <span data-anno='cohort:3-1'>
          <Switch
            label='다음 기수 자동 만들기 · 공개'
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
            onChange={(e) => {
              const day = Number(e.target.value);
              onAutoChange({ ...auto, day, publishDay: Math.max(auto.publishDay, day + 1) });
            }}
          >
            {Array.from({ length: 27 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </Select>
          에 초안을 만들고
        </span>
        <span data-anno='cohort:3-3' className='flex items-center gap-2 type-body-sm text-fg-secondary'>
          <Select
            size='sm'
            aria-label='자동 공개하는 날'
            disabled={!auto.on}
            value={String(auto.publishDay)}
            onChange={(e) => onAutoChange({ ...auto, publishDay: Number(e.target.value) })}
          >
            {Array.from({ length: 28 - auto.day }, (_, i) => auto.day + 1 + i).map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </Select>
          에 공개해 모집을 엽니다
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
