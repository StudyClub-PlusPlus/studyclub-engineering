'use client';

import { useState } from 'react';

import { LIFECYCLE_HINT, LIFECYCLE_LABEL, LIFECYCLE_ORDER } from '@console/components/lifecycle';
import { ACCOUNT_ROLES, PERMISSIONS, PERMISSION_GROUPS, ROLE_LABEL, scopeOf } from '@console/lib/roles';
import { ZONES } from '@core/lib/zones';
import { STUDY_CATEGORIES } from '@studyclub/mock';

const REPO = 'https://github.com/StudyClub-PlusPlus/studyclub-engineering/blob/beta/01-planning/_registry/policies';

/**
 * 정책 라이브러리 — 화면 뒤에 깔린 **값과 규칙**을 한 지면에 모은다.
 *
 * 개발이 「스터디 상태가 몇 종이더라」를 물을 때 화면을 뒤지지 않게 하려는 자리다.
 * **여기 적힌 값은 프로토가 실제로 쓰는 상수를 그대로 읽어 그린다** — 따로 적어 두면 화면이 바뀐 뒤
 * 이 지면만 옛 값을 말하게 된다. 결정의 배경과 근거는 레포의 정책 파일(POL-####)에 있다.
 */
/** 묶음 — 찾는 사람이 먼저 떠올리는 단위로 가른다: 스터디 / 사람. */
const GROUPS = [
  { key: 'study', label: '스터디', sections: ['스터디 종류', '카테고리', '스터디 상태', '신청'] },
  { key: 'member', label: '사람', sections: ['역할과 권한', '시간대', '닉네임', '회원 데이터와 탈퇴'] },
  { key: 'rule', label: '규칙', sections: ['시간 표기 규칙', '창과 알림', '드롭다운 규칙', 'UX 라이팅'] },
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
  '창과 알림': 'modal',
  '드롭다운 규칙': 'filter',
  'UX 라이팅': 'writing',
};

export default function PolicyLibrary() {
  const [group, setGroup] = useState<GroupKey>('study');
  const [active, setActive] = useState<string>(GROUPS[0].sections[0]);
  const current = GROUPS.find((g) => g.key === group) ?? GROUPS[0];
  const show = (title: string) => current.sections.includes(title as never);

  return (
    <div className='mx-auto max-w-5xl px-6 py-10'>
      <h1 className='type-headline-lg'>정책 라이브러리</h1>

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
                className='rounded-lg px-3 py-2 text-left type-label-lg transition-colors'
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
                className={`-mb-px border-b-2 px-4 py-2.5 type-label-lg transition-colors ${
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
            <span key={c} className='rounded-pill border border-border px-3 py-1 type-body-sm text-fg-secondary'>
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
        <P>보조 진행자 역할은 따로 두지 않는다. 스터디 안의 역할은 네비게이터 하나다.</P>

        {PERMISSION_GROUPS.map((group) => (
          <div key={group.key} className='mt-5'>
            <h3 className='type-title-md'>
              {group.label}
              {group.note && <span className='ml-2 font-semibold text-fg-muted'>{group.note}</span>}
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
          <Tr cells={['시간대 약칭', '스터디에 매인 값에만 붙인다 — 그 값은 변환하지 않는다', '목 20:00 KST (반 이름)']} />
          <Tr cells={['날짜', '연-월-일 순서. 자릿수를 맞춰 세로로 읽히게', '2026-10-05 · 26. 10. 05.']} />
          <Tr cells={['남은 날', 'D-N. 지난 것만 따로 구분한다', 'D-4 · 마감 경과']} />
        </Table>
        <P>
          <b>24시간제로 통일한다</b> — 회차 시각, 반 이름, 지역 시계, 알림 발송 이력이 모두 그렇다.
          오전·오후는 한 자리만 달라도 같은 화면 안에서 두 가지 읽기가 생긴다.
        </P>
        <P>
          <b>시각은 보는 사람의 시계로 보여준다.</b> 주 단위로 묶는 집계도 같은 시계로 자른다 —
          자르는 기준과 읽는 기준을 다르게 두면 「이번 주」와 「오늘」이 다른 날을 가리킨다.
        </P>
        <P>
          <b>예외는 스터디에 매인 값뿐이다</b> — 반 이름 · 회차 시각 · 모집 마감 · 시작일. 그 스터디의
          시간대로 적고 <b>약칭을 붙인다.</b> 변환하면 반대편 화면에 「09-16 16:59」 같은 어정쩡한
          시각이 남는다 — 약칭이 「이건 내 시계가 아니다」를 말해 준다.
        </P>
        <P>
          <b>약칭이 없으면 전부 내 시계다.</b> 그래서 「이 표의 시각은 내 시간대 기준입니다」 같은
          안내를 두지 않는다 — 예외가 없는 규칙은 설명할 거리가 없다.
        </P>
        <P>
          <b>모집 마감은 그 스터디 시간대의 그날이 끝날 때다.</b> 캡틴은 날짜만 고른다. 동시
          진행이면 늦게 끝나는 쪽을 쓴다 — 이른 쪽으로 자르면 반대편 크루는 자기 달력으로 아직
          그날인데 이미 닫혀 있다.
        </P>
      </Section>}

      {show('창과 알림') && <Section title='창과 알림' pol='POL-0008' file='POL-0008-screen-rules.md'>
        <P>
          무엇을 쓸지는 <b>「알리는가, 묻는가」</b>가 정한다 — 둘을 섞으면 끝난 일을 닫으려고 손이
          한 번 더 간다.
        </P>
        <Table head={['하는 일', '무엇을 쓰나', '예']}>
          <Tr cells={['알린다 — 그 줄에서 결과가 보인다', '그 자리에 적는다', '마이페이지 줄마다 「저장됨」']} />
          <Tr cells={['알린다 — 그 자리만 봐서는 모른다', '토스트 한 번', '재발송 12건 결과']} />
          <Tr cells={['알리고 다음 길을 준다', '모달 — 액션 하나 + X', '신청 완료 → 내 스터디룸']} />
          <Tr cells={['받는다', '모달 — 액션 하나. 취소 없음', '템플릿 추가, 공개하기']} />
          <Tr cells={['묻는다', '모달 — 취소 + 액션. 취소가 기본 포커스', '삭제, 탈퇴, 전체 재발송']} />
          <Tr cells={['보여준다', '모달 — X 만', '약관 전문, 역할별 권한표']} />
        </Table>
        <P>
          <b>알리기만 하는 모달을 만들지 않는다</b> — 끝난 일을 다음 일 하려고 또 닫게 만든다. 다만{' '}
          <b>다음 길을 주는 창은 알림이 아니다</b>: 신청을 마친 사람에게 「내 스터디룸으로 갈까요」를
          묻는 자리는 모달이 맞다.
        </P>
        <P>
          <b>브라우저 기본 <code>alert()</code> · <code>confirm()</code> 을 쓰지 않는다</b> — 모양을
          맞출 수 없고, 화면이 멈추며, 문구를 다듬을 수도 없다.
        </P>
        <P>
          <b>닫는 길</b> — 우상단 X 하나. <code>Esc</code> 는 X 와 똑같이 동작한다.{' '}
          <b>배경 클릭으로는 닫히지 않는다</b> — 쓰던 것이 사라지는 창을 스쳐 누르다 잃는 일이 생긴다.
          X 는 공용 컴포넌트가 스스로 그리므로 화면에서 따로 넣지 않는다.
        </P>
        <P>
          입력 중에 닫으면 작성하던 것이 그대로 사라진다 — 확인 창을 띄우지 않는다. 묻는 창은{' '}
          <b>Enter 로 액션이 실행되면 안 된다.</b> 액션 버튼은 파괴적 동작임이 드러나게 표시한다.
          묻는 창에만 취소를 두는 이유는 <b>안전한 선택지가 버튼으로 보여야</b> 하기 때문이다.
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

      {show('UX 라이팅') && <Section title='UX 라이팅' pol='POL-0011' file='POL-0011-ux-writing.md'>
        <P>
          <b>사용자 사이트와 운영 콘솔은 다르게 말한다.</b> 읽는 사람도 처지도 달라 하나로 통일하지
          않는다.
        </P>
        <Table head={['', '사용자 사이트', '운영 콘솔']}>
          <Tr cells={['읽는 사람', '크루 — 자원해서 온 사람', '캡틴 — 일하러 온 사람']} />
          <Tr cells={['요청 말끝', '~해 주세요', '~하세요']} />
          <Tr cells={['예', '닉네임을 입력해 주세요', '제목을 입력하세요']} />
        </Table>
        <P>
          콘솔에서 「~해 주세요」를 쓰지 않는 이유는 <b>하루에 수십 번 보는 말</b>이기 때문이다 —
          매번 부탁받을 일이 아니다. 반대로 사용자 사이트에서 「~하세요」만 쓰면 지시하는 말이 된다.
        </P>
        <P>
          <b>훑는 자리는 명사형, 읽는 자리는 문장.</b> 제목 · 라벨 · 버튼 · 열 이름은 명사형으로
          끝낸다(「알림 발송 이력」). 무엇을 해야 하는지 알리는 문장만 서술형이다
          (「참여 중단은 캡틴에게 문의해 주세요.」).
        </P>
        <P>
          <b>한 화면 안에서 말끝을 섞지 않는다</b> — 안내·결과는 「~습니다」로 통일한다.
          <b> 한 문장에 한 가지</b>만 담고, 묻는 말을 먼저 알아야 할 사실을 뒤에 둔다.
        </P>
        <Table head={['뜻', '쓴다', '쓰지 않는다']}>
          <Tr cells={['운영하는 사람', '캡틴', '운영진, 관리자']} />
          <Tr cells={['스터디를 이끄는 크루', '네비게이터', '반장, 리더']} />
          <Tr cells={['참여하는 사람', '크루', '참여자, 멤버, 회원님']} />
          <Tr cells={['분야', '카테고리', '주제, 분야, 태그']} />
          <Tr cells={['스터디에서 빠짐', '참여 중단', '탈퇴(계정에만 쓴다), 강퇴']} />
          <Tr cells={['계정을 지움', '탈퇴', '회원 해지, 계정 삭제']} />
        </Table>
        <P>
          <b>없는 역할을 지어내지 않는다</b> — 「해당 스터디 운영진」 같은 말은 찾아갈 데가 없다.
          사람을 적기 전에 그 역할이 역할·권한 정책에 있는지 본다.
        </P>
        <P>
          <b>쓰지 않는 말</b> — 「정말로」 · 「성공적으로」 · 「완벽하게」 · 느낌표 · 이모지,
          모호한 때(「잠시 후」)와 수(「여러 개」), 그리고 접은 개념(승인 대기 · 임박 ·
          오늘 마감 · 상시 모집 · 주제).
        </P>
        <Table head={['상황', '쓰지 않는다', '쓴다']}>
          <Tr cells={['저장 성공', '성공적으로 저장이 완료되었습니다!', '저장되었습니다.']} />
          <Tr cells={['탈퇴 안내', '지난 기록은 돌아오지 않습니다', '이전 기록은 복구되지 않습니다']} />
          <Tr cells={['첨부 안내', '선택 · 3장까지, 한 장에 5MB', '최대 3장, 장당 5MB']} />
          <Tr cells={['미루기 버튼', '나중에 하기', '스터디 먼저 둘러보기']} />
        </Table>
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
        <h2 className='type-title-md'>{title}</h2>
        <a
          href={`${REPO}/${file}`}
          target='_blank'
          rel='noreferrer'
          className='type-label-sm text-brand underline-offset-4 hover:underline'
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
        <td key={i} className={i === 0 ? 'font-semibold' : 'text-fg-secondary'}>
          {c}
        </td>
      ))}
    </tr>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className='mt-3 type-body-sm text-fg-secondary'>{children}</p>;
}
