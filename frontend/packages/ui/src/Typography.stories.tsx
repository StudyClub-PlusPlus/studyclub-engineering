import type { Meta, StoryObj } from '@storybook/react-vite';

const ROLES = [
  ['type-display-lg', '56 / 64 · 500', '함께 배우는 새로운 시작', '홈 히어로·캠페인. 모바일 36/44'],
  ['type-display-sm', '44 / 52 · 500', '질문하며 발견하는 시간', '상세 핵심 메시지. 모바일 32/42'],
  ['type-headline-lg', '36 / 46 · 600', '스터디 둘러보기', '사용자 사이트 페이지 제목'],
  ['type-headline-md', '28 / 38 · 600', '스터디 관리', '운영 콘솔 페이지 제목·주요 섹션 제목'],
  ['type-headline-sm', '24 / 34 · 600', '진행 방식과 일정', '작은 섹션 제목'],
  ['type-title-lg', '20 / 30 · 600', '제품을 보는 UX 리서치', '스터디 카드·사용자 사이트 카드/패널 제목'],
  ['type-title-md', '18 / 27 · 600', '시스템 디자인 라이브 토크', '행사 카드·운영 콘솔 카드/섹션 제목·리스트 제목'],
  ['type-body-lg', '18 / 30 · 400', '좋은 질문은 서로 다른 경험을 나누는 데서 시작합니다.', '리드 문단·긴 소개'],
  [
    'type-body-md',
    '16 / 27 · 400',
    '매주 하나의 주제를 관찰하고, 질문하고, 함께 정리해요.',
    '기본 본문·일반 폼 입력값/placeholder',
  ],
  [
    'type-body-sm',
    '14 / 22 · 400',
    '신청 후 리더의 확인을 거쳐 참여가 확정돼요.',
    '보조 설명·테이블 내용·조밀한 Console 폼 입력값',
  ],
  [
    'type-label-lg',
    '14 / 20 · 600',
    '시간대 전체 · 스터디 검색',
    'md/lg 버튼·탭·필드 라벨·목록 필터/검색 입력값과 placeholder',
  ],
  ['type-label-sm', '12 / 18 · 500', '모집 중 · 2026.10.18', 'sm 버튼·배지·메타데이터·타임스탬프·캡션'],
] as const;

const meta = { title: 'Foundations/Typography' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Roles: Story = {
  render: () => (
    <div className='space-y-8 bg-page-bg p-6 text-ink'>
      {ROLES.map(([role, spec, sample, usage]) => (
        <section key={role} className='space-y-2 border-b border-border pb-6'>
          <p className='type-label-sm text-fg-muted'>
            <code className='font-mono'>{role}</code> · {spec}
          </p>
          <p className={role}>{sample}</p>
          <p className='type-label-sm text-fg-muted'>{usage}</p>
        </section>
      ))}
      <p className='type-body-md type-prose'>
        본문은 Pretendard Variable로 표시합니다. <strong>강조는 600</strong>을 사용합니다. 긴 한글 문장은 강제로 자르지
        않고 자연스럽게 줄바꿈합니다.
      </p>
      <p className='type-label-sm tnum'>2026.10.18 · 09:30 · 87.5%</p>
      <code className='font-mono type-label-sm'>--color-primary: #5267D8</code>
    </div>
  ),
};
