'use client';

import { useState } from 'react';

import { LIFECYCLE_HINT, LIFECYCLE_LABEL, LIFECYCLE_ORDER } from '@console/components/lifecycle';
import { ACCOUNT_ROLES, PERMISSIONS, PERMISSION_GROUPS, ROLE_LABEL, scopeOf } from '@console/lib/roles';
import { ZONES } from '@core/lib/zones';
import { STUDY_CATEGORIES } from '@studyclub/mock';

const REPO = 'https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/beta/01-planning/_registry/policies';

/**
 * 기획 라이브러리 — 화면 뒤에 깔린 **값과 규칙**을 한 지면에 모은다.
 *
 * 개발이 「스터디 상태가 몇 종이더라」를 물을 때 화면을 뒤지지 않게 하려는 자리다.
 * **여기 적힌 값은 프로토가 실제로 쓰는 상수를 그대로 읽어 그린다** — 따로 적어 두면 화면이 바뀐 뒤
 * 이 지면만 옛 값을 말하게 된다. 결정의 배경과 근거는 레포의 정책 파일(POL-####)에 있다.
 */
/** 묶음 — 찾는 사람이 먼저 떠올리는 단위로 가른다: 스터디 / 사람. */
const GROUPS = [
  { key: 'study', label: '스터디', sections: ['스터디 종류', '카테고리', '스터디 상태', '신청'] },
  { key: 'member', label: '사람', sections: ['역할과 권한', '시간대', '닉네임', '회원 데이터와 탈퇴'] },
  { key: 'rule', label: '규칙', sections: ['시간 표기 규칙', '모달 닫기 규칙', '드롭다운 규칙'] },
] as const;

type GroupKey = (typeof GROUPS)[number]['key'];

/** 제목 → 앵커 id. 한글을 그대로 쓰지 않는다 — 주소에 섞이면 읽기 어렵다. */
const ANCHOR: Record<string, string> = {
  '스터디 종류': 'kind',
  카테고리: 'category',
  '스터디 상태': 'status',
  신청: 'application',
  '역할과 권한': 'roles',
  시간대: 'timezone',
  닉네임: 'nickname',
  '회원 데이터와 탈퇴': 'account',
  '시간 표기 규칙': 'time-format',
  '모달 닫기 규칙': 'modal',
  '드롭다운 규칙': 'filter',
};

export default function PolicyLibrary() {
  const [group, setGroup] = useState<GroupKey>('study');
  const [active, setActive] = useState<string>(GROUPS[0].sections[0]);
  const current = GROUPS.find((g) => g.key === group) ?? GROUPS[0];
  const show = (title: string) => current.sections.includes(title as never);

  return (
    <div className='mx-auto max-w-5xl px-6 py-10'>
      <h1 className='text-2xl font-extrabold tracking-tight'>기획 라이브러리</h1>

      <div className='mt-6 grid gap-8 lg:grid-cols-[9rem_1fr]'>
        {/* 묶음은 왼쪽에 세로로 — 메뉴와 같은 자리라 눈이 먼저 간다 */}
        <aside>
          <div className='sticky top-6 flex flex-col gap-0.5'>
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type='button'
                onClick={() => {
                  setGroup(g.key);
                  setActive(g.sections[0]);
                }}
                className='rounded-lg px-3 py-2 text-left text-sm transition-colors'
                style={
                  g.key === group
                    ? { background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontWeight: 600 }
                    : { color: 'var(--color-fg-muted)' }
                }
              >
                {g.label}
              </button>
            ))}
          </div>
        </aside>

        <div>
          {/*
            절 바로가기 — 서류철 탭처럼. 지금 보고 있는 절에 밑줄이 서고, 그 줄이 본문과 이어진다.
            칩으로 두면 고르는 버튼처럼 보여 「눌러야 내용이 바뀌나」 하고 멈칫하게 된다.
          */}
          <nav className='mb-6 flex flex-wrap gap-1 border-b border-border'>
            {current.sections.map((title) => (
              <a
                key={title}
                href={`#${ANCHOR[title]}`}
                onClick={() => setActive(title)}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active === title
                    ? 'border-brand text-fg'
                    : 'border-transparent text-fg-muted hover:text-fg-secondary'
                }`}
              >
                {title}
              </a>
            ))}
          </nav>

      {show('스터디 종류') && <Section title='스터디 종류' pol='POL-0003' file='POL-0003-study-fields.md'>
        <Table head={['값', '뜻', '기수']}>
          <Tr cells={['스터디', '한 번 열고 끝나는 모임', '기수 1개 — 새로 열면 새 스터디']} />
          <Tr cells={['클럽', '기수를 거듭하며 이어지는 모임', '기수 여러 개 — 다음 기수를 잇는다']} />
        </Table>
        <P>종류는 프로그램에 붙는다. 한 번 정하면 바꾸지 않는다 — 바꾸면 지난 기수의 이력이 끊긴다.</P>
      </Section>}

      {show('카테고리') && <Section title='카테고리' pol='POL-0003' file='POL-0003-study-fields.md'>
        <div className='flex flex-wrap gap-1.5'>
          {STUDY_CATEGORIES.map((c) => (
            <span key={c} className='rounded-pill border border-border px-3 py-1 text-[13px] text-fg-secondary'>
              {c}
            </span>
          ))}
        </div>
        <P>
          {STUDY_CATEGORIES.length}종 고정. <b>스터디마다 하나만</b> 고른다 — 여럿을 달면 「무슨 분야인가」에
          답이 둘이 되고, 목록·대시보드의 합계가 총 스터디 수와 어긋난다.
        </P>
      </Section>}

      {show('스터디 상태') && <Section title='스터디 상태' pol='POL-0002' file='POL-0002-study-status.md'>
        <Table head={['값', '화면 표기', '뜻', '다음으로 넘기는 사람']}>
          {LIFECYCLE_ORDER.map((key) => (
            <Tr
              key={key}
              cells={[
                <code key='c'>{key}</code>,
                LIFECYCLE_LABEL[key],
                LIFECYCLE_HINT[key].meaning,
                LIFECYCLE_HINT[key].next ?? '—',
              ]}
            />
          ))}
        </Table>
        <P>
          공개 여부는 따로 저장하지 않는다 — <code>STATUS != DRAFT</code> 면 사이트에 보인다. 모집 상태
          (모집중 · 모집 마감)도 저장하지 않고 <b>마감일과 정원으로 매번 계산</b>한다. 상시 모집은 없다.
        </P>
      </Section>}

      {show('역할과 권한') && <Section title='역할과 권한' pol='POL-0001' file='POL-0001-roles.md'>
        <Table head={['층', '값', '누가 바꾸나', 'DB']}>
          <Tr cells={['계정 권한', ACCOUNT_ROLES.map((r) => r.label).join(' · '), '캡틴이 유저 목록에서', 'ACCOUNT.SYSTEM_ROLE = ADMIN / MEMBER']} />
          <Tr cells={['스터디 역할', '네비게이터', '캡틴이 스터디 크루 명단에서', 'STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER']} />
        </Table>
        <P>부반장은 두지 않는다. 스터디 안의 역할은 네비게이터 하나다.</P>

        {PERMISSION_GROUPS.map((group) => (
          <div key={group.key} className='mt-5'>
            <h3 className='text-sm font-bold'>
              {group.label}
              {group.note && <span className='ml-2 font-medium text-fg-muted'>{group.note}</span>}
            </h3>
            <Table head={['하는 일', ...group.roles.map((r) => ROLE_LABEL[r])]}>
              {PERMISSIONS.filter((p) => p.group === group.key).map((p) => (
                <Tr
                  key={p.key}
                  cells={[
                    p.label,
                    ...group.roles.map((role) => (scopeOf(role, p.key) === 'none' ? '—' : '✓')),
                  ]}
                />
              ))}
            </Table>
          </div>
        ))}
      </Section>}

      {show('신청') && <Section title='신청' pol='POL-0004' file='POL-0004-application.md'>
        <P>
          <b>신청은 상태를 갖지 않는다.</b> 행이 있으면 제출 완료이고 곧 참여다 — 승인·거절·검토·대기
          단계가 없다. 한 모집 회차에 한 번만 낼 수 있고, 정원은 기수 명부의 활성 인원으로 센다. 반은 신청
          이후에 정해지므로 반 정원은 신청 검사에 넣지 않는다.
        </P>
      </Section>}

      {show('시간대') && <Section title='시간대' pol='POL-0006' file='POL-0006-timezone.md'>
        <Table head={['표기', 'IANA']}>
          {ZONES.map((z) => (
            <Tr key={z.zone} cells={[z.ko, <code key='c'>{z.zone}</code>]} />
          ))}
        </Table>
        <P>
          시간대가 곧 거주 지역이고, 반이 갈리는 단위다. 오프셋은 저장하지 않는다 — 서머타임 때문에 북미가
          한 시간씩 움직인다. 화면에는 <b>보는 사람의 시간대</b>로 바꿔 적는다.
        </P>
      </Section>}

      {show('닉네임') && <Section title='닉네임' pol='POL-0005' file='POL-0005-nickname.md'>
        <P>
          2~20자 · 모든 언어의 글자와 숫자, 밑줄(_). 공백·이모지·특수문자는 받지 않는다. 중복은 불가하고
          대소문자를 구분하지 않는다. 비교값은 앞뒤 공백을 떼고 NFC 로 모은 뒤 소문자로 만든 것이며, 저장은
          입력한 그대로 한다. <b>가입과 프로필 수정이 같은 규칙</b>을 쓴다.
        </P>
      </Section>}

      {show('시간 표기 규칙') && <Section title='시간 표기 규칙' pol='POL-0006' file='POL-0006-timezone.md'>
        <Table head={['무엇', '규칙', '예']}>
          <Tr cells={['시각', '24시간제. 오전·오후를 붙이지 않는다', '20:00 · 09:00']} />
          <Tr cells={['기준 시간대', '보는 사람의 시간대로 바꿔 적는다', '서버는 UTC 로 주고받는다']} />
          <Tr cells={['시간대 약칭', '한 화면이 여러 시간대를 섞어 보일 때만 붙인다', '목 20:00 KST (반 이름)']} />
          <Tr cells={['날짜', '연-월-일 순서. 자릿수를 맞춰 세로로 읽히게', '2026-10-05 · 26. 10. 05.']} />
          <Tr cells={['남은 날', 'D-N. 지난 것만 따로 구분한다', 'D-4 · 마감 경과']} />
        </Table>
        <P>
          <b>24시간제로 통일한다</b> — 회차 시각, 반 이름, 지역 시계, 알림 발송 이력이 모두 그렇다.
          오전·오후는 한 자리만 달라도 같은 화면 안에서 두 가지 읽기가 생긴다.
        </P>
        <P>
          약칭은 <b>필요할 때만</b> 붙인다. 반 이름처럼 한 화면에 한국·북미 시각이 함께 서는 자리에는
          붙이고, 운영자가 자기 시간대로만 읽는 목록(발송 이력 등)에는 붙이지 않는다 — 매 줄에 같은
          약칭이 반복되면 읽을 것만 늘어난다.
        </P>
      </Section>}

      {show('모달 닫기 규칙') && <Section title='모달 닫기 규칙' pol='POL-0008' file='POL-0008-screen-rules.md'>
        <P>
          모든 모달은 <b>우상단에 X</b> 를 둔다. <code>Esc</code> 는 X 와 똑같이 동작한다.{' '}
          <b>배경 클릭으로는 닫히지 않는다</b> — 쓰던 것이 사라지는 창을 스쳐 누르다 잃는 일이 생긴다.
        </P>
        <Table head={['성격', '예', '하단 버튼']}>
          <Tr cells={['읽기 전용', '약관 전문, 명단 보기', '없음. X 만']} />
          <Tr cells={['입력·설정', '공개하기, 필터, 템플릿 추가', '액션 하나. 취소를 두지 않는다']} />
          <Tr cells={['결정을 묻는다', '삭제, 탈퇴, 거절', '취소 + 액션. 취소가 기본 포커스']} />
        </Table>
        <P>
          입력·설정 모달은 닫으면 작성 중이던 입력이 그대로 사라진다 — 확인 창을 띄우지 않는다. 결정을
          묻는 모달은 <b>Enter 로 액션이 실행되면 안 된다.</b> 액션 버튼은 파괴적 동작임이 드러나게 표시한다.
        </P>
        <P>
          X · <code>Esc</code> · 취소는 모두 같은 결과(닫기)를 낸다. 결정을 묻는 모달에만 취소를 두는 이유는{' '}
          <b>안전한 선택지가 버튼으로 보여야</b> 하기 때문이다 — 액션 버튼이 화면에서 유일한 버튼이 되는
          구성은 만들지 않는다.
        </P>
      </Section>}

      {show('드롭다운 규칙') && <Section title='드롭다운 규칙' pol='POL-0008' file='POL-0008-screen-rules.md'>
        <P>
          <b>고르기 전에는 축 이름만 보인다.</b> 「상태 전체」·「카테고리 전체」처럼 적지 않는다 — 이미
          무언가 걸러 둔 것처럼 읽힌다.
        </P>
        <Table head={['때', '첫 줄', '왜']}>
          <Tr cells={['아직 고르지 않음', '축 이름 (「상태」 · 「카테고리」)', '무엇을 고르는 칸인지만 말한다']} />
          <Tr cells={['하나 고른 뒤', '「전체」', '되돌아갈 길이 그 자리에 생긴다']} />
        </Table>
        <P>
          고르지 않은 축은 계속 축 이름을 유지한다 — 축마다 따로 움직인다. 필터를 바꾸면 첫 페이지로
          돌아가고, 고른 값은 저장하지 않는다.
        </P>
      </Section>}

      {show('회원 데이터와 탈퇴') && <Section title='회원 데이터와 탈퇴' pol='POL-0007' file='POL-0007-account-data.md'>
        <P>
          실명과 프로필 이미지를 받지 않는다 — 사람을 가리키는 이름은 닉네임 하나다. 탈퇴는 즉시 처리하고
          막는 조건을 두지 않는다. 계정·프로필·참여·관심·디스코드 연동은 지우고, 출석 기록은 누구인지 알 수
          없게 처리한 뒤 남긴다.
        </P>
      </Section>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, pol, file, children }: { title: string; pol: string; file: string; children: React.ReactNode }) {
  return (
    <section id={ANCHOR[title]} className='mt-10 scroll-mt-6 first:mt-0'>
      <div className='flex items-baseline gap-2'>
        <h2 className='text-lg font-bold tracking-tight'>{title}</h2>
        <a
          href={`${REPO}/${file}`}
          target='_blank'
          rel='noreferrer'
          className='text-xs font-semibold text-brand underline-offset-4 hover:underline'
        >
          {pol}
        </a>
      </div>
      <div className='mt-3'>{children}</div>
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className='card mt-3 overflow-x-auto'>
      <table className='bo-table'>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Tr({ cells }: { cells: React.ReactNode[] }) {
  return (
    <tr>
      {cells.map((c, i) => (
        <td key={i} className={i === 0 ? 'font-medium' : 'text-fg-secondary'}>
          {c}
        </td>
      ))}
    </tr>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className='mt-3 text-sm leading-relaxed text-fg-secondary'>{children}</p>;
}
